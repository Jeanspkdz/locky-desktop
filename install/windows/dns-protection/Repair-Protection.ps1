param(
  [string] $ConfigPath = (Join-Path $PSScriptRoot 'protection.json'),
  [string] $LogPath = (Join-Path $env:ProgramData 'Locky\Protection\protection.log')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Import-Module NetAdapter -ErrorAction SilentlyContinue
Import-Module DnsClient -ErrorAction SilentlyContinue
Import-Module NetSecurity -ErrorAction SilentlyContinue

function Write-ProtectionLog([string] $Message) {
  $directory = Split-Path -Parent $LogPath
  if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    & "$env:WINDIR\System32\icacls.exe" $directory '/inheritance:r' '/grant:r' `
      '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(RX)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not secure the protection log directory.' }
  }
  $line = '{0:o} {1}' -f [DateTime]::UtcNow, $Message
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Get-IPv4Exclusions([string[]] $Excluded) {
  # Produce exact CIDR ranges covering 0.0.0.0/0 except the permitted resolver IPs.
  $blocked = @($Excluded | ForEach-Object { [uint64][BitConverter]::ToUInt32(([IPAddress]::Parse($_)).GetAddressBytes()[3..0], 0) } | Sort-Object -Unique)
  $limit = [uint64]4294967295
  $cursor = [uint64]0
  $ranges = [System.Collections.Generic.List[string]]::new()
  foreach ($ip in $blocked) {
    if ($ip -gt $cursor) { Add-IPv4Range $cursor ($ip - 1) $ranges }
    $cursor = $ip + 1
  }
  if ($cursor -le $limit) { Add-IPv4Range $cursor $limit $ranges }
  return $ranges.ToArray()
}

function Add-IPv4Range([uint64] $Start, [uint64] $End, $Ranges) {
  while ($Start -le $End) {
    $alignment = 0
    $probe = $Start
    while ($alignment -lt 32 -and ($probe -band 1) -eq 0) {
      $alignment++
      $probe = [uint64]($probe -shr 1)
    }
    $remaining = [int][Math]::Floor([Math]::Log2($End - $Start + 1))
    $prefix = 32 - [Math]::Min($alignment, $remaining)
    $bytes = [BitConverter]::GetBytes([uint32]$Start)
    [Array]::Reverse($bytes)
    $address = ([IPAddress]::new($bytes)).ToString()
    $Ranges.Add("$address/$prefix")
    $Start += [uint64][Math]::Pow(2, 32 - $prefix)
  }
}

function Test-AnyOrEmpty($Value) {
  if ($null -eq $Value) { return $true }
  $values = @($Value | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) -and $_ -ne 'Any' })
  return $values.Count -eq 0
}

function Test-UnrestrictedFirewallPlatform($Rule) {
  try {
    $property = $Rule.CimInstanceProperties['Platforms']
    if ($null -eq $property) {
      $instanceId = ([string]$Rule.Name).Replace("'", "''")
      $cimRules = @(Get-CimInstance -Namespace 'root/standardcimv2' -ClassName MSFT_NetFirewallRule `
        -Filter "InstanceID = '$instanceId'" -ErrorAction Stop)
      if ($cimRules.Count -ne 1) { return $false }
      $property = $cimRules[0].CimInstanceProperties['Platforms']
    }
    if ($null -eq $property) { return $false }
    return (Test-AnyOrEmpty $property.Value)
  } catch {
    # If the platform constraint cannot be inspected, recreate the managed rule
    # with New-NetFirewallRule's unrestricted default instead of trusting it.
    return $false
  }
}

function Set-OwnedFirewallRule([string] $Name, [int] $Port, [string] $Protocol, [string[]] $RemoteAddress, [string[]] $InterfaceAlias) {
  $existing = Get-NetFirewallRule -Name $Name -ErrorAction SilentlyContinue
  if ($existing) {
    $filter = $existing | Get-NetFirewallPortFilter
    $address = $existing | Get-NetFirewallAddressFilter
    $application = $existing | Get-NetFirewallApplicationFilter
    $service = $existing | Get-NetFirewallServiceFilter
    $interface = $existing | Get-NetFirewallInterfaceFilter
    $security = $existing | Get-NetFirewallSecurityFilter
    $actualPorts = @($filter.RemotePort | Sort-Object) -join ','
    $actualRemote = @($address.RemoteAddress | Sort-Object) -join ','
    $expectedRemote = @($RemoteAddress | Sort-Object) -join ','
    $actualLocal = @($address.LocalAddress | Sort-Object) -join ','
    $actualLocalPorts = @($filter.LocalPort | Sort-Object) -join ','
    $actualInterfaces = @($interface.InterfaceAlias | Sort-Object) -join ','
    $expectedInterfaces = @($InterfaceAlias | Sort-Object) -join ','
    $correct = $existing.Enabled -eq 'True' -and $existing.Direction -eq 'Outbound' -and
      $existing.Action -eq 'Block' -and $existing.Profile -eq 'Any' -and
      $existing.InterfaceType -eq 'Any' -and
      $actualPorts -eq "$Port" -and $actualLocalPorts -eq 'Any' -and
      $filter.Protocol -eq $Protocol -and $actualRemote -eq $expectedRemote -and
      $actualLocal -eq 'Any' -and $application.Program -eq 'Any' -and
      (Test-AnyOrEmpty $application.Package) -and (Test-AnyOrEmpty $service.Service) -and
      (Test-AnyOrEmpty $address.RemoteDynamicKeywordAddresses) -and $actualInterfaces -eq $expectedInterfaces -and
      (Test-AnyOrEmpty $existing.Owner) -and $existing.LocalOnlyMapping -eq $false -and
      $existing.LooseSourceMapping -eq $false -and $filter.DynamicTarget -eq 'Any' -and
      (Test-UnrestrictedFirewallPlatform $existing) -and
      $security.Authentication -eq 'NotRequired' -and $security.Encryption -eq 'NotRequired' -and
      $security.OverrideBlockRules -eq $false -and (Test-AnyOrEmpty $security.LocalUser) -and
      (Test-AnyOrEmpty $security.RemoteUser) -and (Test-AnyOrEmpty $security.RemoteMachine)
    if ($correct) { return }
    $existing | Remove-NetFirewallRule
  }
  New-NetFirewallRule -Name $Name -DisplayName "Locky DNS protection $Protocol/$Port" `
    -Direction Outbound -Action Block -Enabled True -Profile Any -Protocol $Protocol `
    -RemotePort $Port -LocalPort Any -RemoteAddress $RemoteAddress -LocalAddress Any `
    -Program Any -InterfaceAlias $InterfaceAlias -InterfaceType Any `
    -DynamicTarget Any -LocalOnlyMapping $false -LooseSourceMapping $false `
    -Authentication NotRequired -Encryption NotRequired -OverrideBlockRules $false | Out-Null
  Write-ProtectionLog "Restored firewall rule $Name"
}

try {
  $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  $dns = @($config.dnsServers)
  if ($dns.Count -ne 2 -or $dns[0] -ne '1.1.1.3' -or $dns[1] -ne '1.0.0.3') {
    throw 'The configured DNS resolvers must remain Cloudflare Families addresses.'
  }
  $exceptions = @($config.adapterNameExceptions)
  foreach ($adapter in Get-NetAdapter -IncludeHidden | Where-Object Status -ne 'Disabled') {
    if ($exceptions -contains $adapter.Name) { continue }
    try {
      $current = @(Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction Stop).ServerAddresses
      if (($current -join ',') -ne ($dns -join ',')) {
        Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses $dns
        Clear-DnsClientCache
        Write-ProtectionLog "Restored DNS on adapter '$($adapter.Name)'"
      }
    } catch {
      Write-ProtectionLog "ERROR restoring DNS on adapter '$($adapter.Name)': $($_.Exception.Message)"
    }
  }

  try {
    $disabledProfiles = @(Get-NetFirewallProfile -Profile Domain,Private,Public | Where-Object { -not $_.Enabled })
    if ($disabledProfiles.Count -gt 0) {
      Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True
      Write-ProtectionLog ("Re-enabled Windows Firewall profiles: " + (($disabledProfiles.Name) -join ', '))
    }
  } catch { Write-ProtectionLog "ERROR ensuring Windows Firewall profiles are enabled: $($_.Exception.Message)" }
  $v4 = Get-IPv4Exclusions $dns
  $firewallAliases = @(Get-NetAdapter -IncludeHidden | Where-Object {
    $_.Status -ne 'Disabled' -and $exceptions -notcontains $_.Name
  } | Select-Object -ExpandProperty Name -Unique | ForEach-Object {
    [System.Management.Automation.WildcardPattern]::Escape($_)
  })
  if ($firewallAliases.Count -eq 0) {
    $obsoleteRules = @(Get-NetFirewallRule -Name 'Locky-DNS-*' -ErrorAction SilentlyContinue)
    if ($obsoleteRules.Count -gt 0) {
      $obsoleteRules | Remove-NetFirewallRule
      Write-ProtectionLog 'Removed DNS firewall rules because all adapters are excluded or disabled.'
    }
  } else {
    foreach ($port in @(53, 853)) {
      foreach ($protocol in @('TCP', 'UDP')) {
        $v4Name = "Locky-DNS-$port-$protocol-v4"
        $v6Name = "Locky-DNS-$port-$protocol-v6"
        try { Set-OwnedFirewallRule $v4Name $port $protocol $v4 $firewallAliases }
        catch { Write-ProtectionLog "ERROR restoring firewall rule $v4Name`: $($_.Exception.Message)" }
        try {
          # The only approved resolvers are IPv4, so all IPv6 DNS/DoT egress is blocked.
          Set-OwnedFirewallRule $v6Name $port $protocol @('::/0') $firewallAliases
        } catch { Write-ProtectionLog "ERROR restoring firewall rule $v6Name`: $($_.Exception.Message)" }
      }
    }
  }

  $policyRoots = @(
    'HKLM:\SOFTWARE\Policies\Google\Chrome',
    'HKLM:\SOFTWARE\Policies\BraveSoftware\Brave',
    'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
  )
  foreach ($root in $policyRoots) {
    try {
      if (-not (Test-Path $root)) { New-Item -Path $root -Force | Out-Null }
      $changed = $false
      $key = Get-Item -LiteralPath $root
      $modeExists = $key.GetValueNames() -contains 'DnsOverHttpsMode'
      $modeCorrect = $modeExists -and $key.GetValueKind('DnsOverHttpsMode') -eq [Microsoft.Win32.RegistryValueKind]::String -and
        $key.GetValue('DnsOverHttpsMode') -ceq 'off'
      if (-not $modeCorrect) {
        New-ItemProperty -Path $root -Name DnsOverHttpsMode -PropertyType String -Value 'off' -Force | Out-Null
        $changed = $true
      }
      $clientExists = $key.GetValueNames() -contains 'BuiltInDnsClientEnabled'
      $clientCorrect = $clientExists -and $key.GetValueKind('BuiltInDnsClientEnabled') -eq [Microsoft.Win32.RegistryValueKind]::DWord -and
        $key.GetValue('BuiltInDnsClientEnabled') -eq 0
      if (-not $clientCorrect) {
        New-ItemProperty -Path $root -Name BuiltInDnsClientEnabled -PropertyType DWord -Value 0 -Force | Out-Null
        $changed = $true
      }
      if ($changed) { Write-ProtectionLog "Restored browser DNS policy at $root" }
    } catch { Write-ProtectionLog "ERROR restoring browser DNS policy at $root`: $($_.Exception.Message)" }
  }
} catch {
  Write-ProtectionLog "ERROR $($_.Exception.Message)"
  throw
}
