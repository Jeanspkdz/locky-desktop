param([string] $InstallDirectory = (Join-Path $env:ProgramFiles 'Locky Desktop\resources\locky\dns-protection'))
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this script from an elevated PowerShell session.' }

$source = $PSScriptRoot
New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
if ([System.IO.Path]::GetFullPath($source).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')) {
  Get-ChildItem -LiteralPath $source -File | Where-Object Name -ne 'Install-DnsProtection.ps1' | Copy-Item -Destination $InstallDirectory -Force
}
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path $csc)) { throw '.NET Framework 4.x compiler is required to build the Windows service.' }
& $csc '/nologo' '/target:winexe' '/optimize+' '/reference:System.ServiceProcess.dll' '/reference:System.Web.Extensions.dll' "/out:$(Join-Path $InstallDirectory 'LockyDnsProtection.exe')" (Join-Path $InstallDirectory 'ProtectionService.cs')
if ($LASTEXITCODE -ne 0) { throw 'Could not compile the Windows service.' }

$icacls = Join-Path $env:WINDIR 'System32\icacls.exe'
$dataRoot = Join-Path $env:ProgramData 'Locky\Protection'
New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
& $icacls $dataRoot '/inheritance:r' '/grant:r' '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the protection data directory to SYSTEM and Administrators.' }
$baselinePath = Join-Path $dataRoot 'baseline.json'
& (Join-Path $InstallDirectory 'Save-ProtectionBaseline.ps1') -SnapshotPath $baselinePath

# Remove credentials left by older versions that required a separate Locky password.
Remove-Item -LiteralPath (Join-Path $dataRoot 'credential.json') -Force -ErrorAction SilentlyContinue
& $icacls $dataRoot '/reset' '/T' '/C' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not reset the protection data directory ACL.' }
& $icacls $dataRoot '/inheritance:r' '/grant:r' '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(RX)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not finalize the protection data directory ACL.' }

$serviceRepair = Join-Path $InstallDirectory 'Repair-Service.ps1'
$takeown = Join-Path $env:WINDIR 'System32\takeown.exe'
& $takeown '/F' $InstallDirectory '/A' '/R' '/D' 'Y' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not recover ownership of DNS service files.' }
& $icacls $InstallDirectory '/reset' '/T' '/C' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not reset DNS service file permissions.' }
& $icacls $InstallDirectory '/inheritance:r' '/grant:r' '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(RX)' '*S-1-5-32-545:(OI)(CI)(RX)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not secure the installation directory ACL.' }
$action = New-ScheduledTaskAction -Execute (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$serviceRepair`""
$startup = New-ScheduledTaskTrigger -AtStartup
$minute = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$principalTask = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -Hidden -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Locky DNS Protection Watchdog' -Action $action -Trigger @($startup, $minute) -Principal $principalTask -Settings $settings -Force | Out-Null
& $serviceRepair
if ((Get-Service -Name LockyDnsProtection -ErrorAction Stop).Status -ne 'Running') { throw 'DNS protection service was not started.' }
Write-Output 'Locky DNS protection service and watchdog were installed.'
