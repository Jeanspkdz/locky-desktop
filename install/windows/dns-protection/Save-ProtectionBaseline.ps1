param([Parameter(Mandatory = $true)][string] $SnapshotPath)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $SnapshotPath) { return }
$policies = @(
  'HKLM:\SOFTWARE\Policies\Google\Chrome',
  'HKLM:\SOFTWARE\Policies\BraveSoftware\Brave',
  'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
)
$policyBaseline = foreach ($path in $policies) {
  $item = Get-Item -LiteralPath $path -ErrorAction SilentlyContinue
  foreach ($name in @('DnsOverHttpsMode', 'BuiltInDnsClientEnabled')) {
    $exists = $null -ne $item -and $item.GetValueNames() -contains $name
    $kind = if ($exists) { $item.GetValueKind($name).ToString() } else { $null }
    if ($exists -and $kind -notin @('String', 'DWord', 'QWord', 'ExpandString', 'MultiString', 'Binary')) {
      throw "Unsupported existing registry value type '$kind' at $path\$name."
    }
    $value = if (-not $exists) { $null } elseif ($kind -eq 'Binary') {
      [Convert]::ToBase64String([byte[]]$item.GetValue($name))
    } else {
      $item.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    }
    [pscustomobject]@{ Path = $path; Name = $name; Exists = $exists; Kind = $kind; Value = $value }
  }
}
$baseline = [ordered]@{
  version = 1
  adapters = @(Get-NetAdapter -IncludeHidden | Where-Object Status -ne 'Disabled' | ForEach-Object {
    $addresses = @(Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
    [pscustomobject]@{ Guid = $_.InterfaceGuid.ToString(); Name = $_.Name; Servers = $addresses }
  })
  firewall = @(Get-NetFirewallProfile -Profile Domain,Private,Public | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Enabled = [bool]$_.Enabled } })
  policies = @($policyBaseline)
}
$parent = Split-Path -Parent $SnapshotPath
New-Item -ItemType Directory -Path $parent -Force | Out-Null
$baseline | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $SnapshotPath -Encoding UTF8
