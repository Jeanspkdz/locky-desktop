param([Parameter(Mandatory = $true)][string] $SnapshotPath)
$ErrorActionPreference = 'Stop'
$baseline = Get-Content -LiteralPath $SnapshotPath -Raw | ConvertFrom-Json
if ($baseline.version -ne 1) { throw 'Unsupported protection baseline.' }
Get-NetFirewallRule -Name 'Locky-DNS-*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
foreach ($profile in $baseline.firewall) {
  Set-NetFirewallProfile -Profile $profile.Name -Enabled ([bool]$profile.Enabled)
}
$savedGuids = @($baseline.adapters | ForEach-Object Guid)
foreach ($adapterNow in Get-NetAdapter -IncludeHidden | Where-Object Status -ne 'Disabled') {
  if ($savedGuids -contains $adapterNow.InterfaceGuid.ToString()) { continue }
  $serversNow = @(Get-DnsClientServerAddress -InterfaceIndex $adapterNow.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
  if (@($serversNow) -join ',' -eq '1.1.1.3,1.0.0.3') {
    Set-DnsClientServerAddress -InterfaceIndex $adapterNow.ifIndex -ResetServerAddresses
  }
}
foreach ($saved in $baseline.adapters) {
  $adapter = Get-NetAdapter -IncludeHidden | Where-Object { $_.InterfaceGuid.ToString() -eq $saved.Guid } | Select-Object -First 1
  if ($null -eq $adapter) { continue }
  if (@($saved.Servers).Count -eq 0) {
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ResetServerAddresses
  } else {
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses @($saved.Servers)
  }
}
foreach ($saved in $baseline.policies) {
  if (-not (Test-Path $saved.Path)) { New-Item -Path $saved.Path -Force | Out-Null }
  if ($saved.Exists) {
    $value = if ($saved.Kind -eq 'Binary') { [Convert]::FromBase64String($saved.Value) } else { $saved.Value }
    New-ItemProperty -Path $saved.Path -Name $saved.Name -PropertyType $saved.Kind -Value $value -Force | Out-Null
  } else {
    Remove-ItemProperty -Path $saved.Path -Name $saved.Name -ErrorAction SilentlyContinue
  }
}
Clear-DnsClientCache
