param()
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this script from an elevated PowerShell session.' }
$dataRoot = Join-Path $env:ProgramData 'Locky\Protection'
Unregister-ScheduledTask -TaskName 'Locky DNS Protection Watchdog' -Confirm:$false -ErrorAction SilentlyContinue
Stop-Service -Name LockyDnsProtection -Force -ErrorAction SilentlyContinue
& "$env:WINDIR\System32\sc.exe" delete LockyDnsProtection | Out-Null
Start-Sleep -Seconds 2
$baseline = Join-Path $dataRoot 'baseline.json'
if (Test-Path -LiteralPath $baseline) { & (Join-Path $PSScriptRoot 'Restore-ProtectionBaseline.ps1') -SnapshotPath $baseline }
if (Test-Path -LiteralPath $dataRoot) {
  & "$env:WINDIR\System32\takeown.exe" '/F' $dataRoot '/A' '/R' '/D' 'Y' | Out-Null
  & "$env:WINDIR\System32\icacls.exe" $dataRoot '/grant' '*S-1-5-32-544:(OI)(CI)(F)' '/T' '/C' | Out-Null
  Remove-Item -LiteralPath $dataRoot -Recurse -Force
}
$programFiles = [System.IO.Path]::GetFullPath($env:ProgramFiles).TrimEnd('\') + '\'
$installPath = [System.IO.Path]::GetFullPath($PSScriptRoot)
if (-not $installPath.StartsWith($programFiles, [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetFileName($installPath) -ne 'dns-protection') {
  throw 'Refusing to remove files outside the expected Program Files protection directory.'
}
& "$env:WINDIR\System32\takeown.exe" '/F' $installPath '/A' '/R' '/D' 'Y' | Out-Null
& "$env:WINDIR\System32\icacls.exe" $installPath '/grant' '*S-1-5-32-544:(OI)(CI)(F)' '/T' '/C' | Out-Null
Remove-Item -LiteralPath $installPath -Recurse -Force
Write-Output 'Service, watchdog, DNS rules, browser policy changes, saved baseline, and protection files were removed.'
