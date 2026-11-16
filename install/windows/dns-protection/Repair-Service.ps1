$ErrorActionPreference = 'Stop'
$serviceName = 'LockyDnsProtection'
$serviceExe = Join-Path $PSScriptRoot 'LockyDnsProtection.exe'
$scExe = Join-Path $env:WINDIR 'System32\sc.exe'
if (-not (Test-Path -LiteralPath $serviceExe)) { throw "Service executable is missing: $serviceExe" }

function Invoke-ServiceControl([string[]] $Arguments) {
  $output = & $scExe @Arguments 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "sc.exe $($Arguments[0]) failed ($code): $($output -join ' ')" }
  return $output
}

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
  $quotedPath = '"' + $serviceExe + '"'
  New-Service -Name $serviceName -BinaryPathName $quotedPath -DisplayName 'Locky DNS Protection' -StartupType Automatic -ErrorAction Stop | Out-Null
  $service = Get-Service -Name $serviceName -ErrorAction Stop
}

$quotedPath = '"' + $serviceExe + '"'
Invoke-ServiceControl -Arguments @('config', $serviceName, 'binPath=', $quotedPath, 'start=', 'auto', 'obj=', 'LocalSystem') | Out-Null
Invoke-ServiceControl -Arguments @('description', $serviceName, 'Locky system DNS protection service') | Out-Null
Invoke-ServiceControl -Arguments @('failure', $serviceName, 'reset=', '86400', 'actions=', 'restart/5000/restart/15000/restart/60000') | Out-Null
Invoke-ServiceControl -Arguments @('failureflag', $serviceName, '1') | Out-Null
$serviceSddl = 'D:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCLORC;;;AU)'
Invoke-ServiceControl -Arguments @('sdset', $serviceName, $serviceSddl) | Out-Null
$service.Refresh()
if ($service.Status -ne 'Running') { Start-Service -Name $serviceName -ErrorAction Stop }
$service.Refresh()
if ($service.Status -ne 'Running') { throw "Service $serviceName did not start." }
