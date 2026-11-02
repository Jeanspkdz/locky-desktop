param(
  [Parameter(Mandatory = $true)][string]$AppExecutable,
  [Parameter(Mandatory = $true)][string]$AppRoot
)

$ErrorActionPreference = 'Stop'
$hostName = 'com.locky.desktop'
$manifestDirectory = Join-Path $env:LOCALAPPDATA 'LockyDesktop'
$manifestPath = Join-Path $manifestDirectory "$hostName.json"
$chromiumExtensionId = 'pgphggplmacpiglkndjhpaojeeoomfdn'
$firefoxExtensionId = 'locky-desktop@locky.local'
$resolvedAppExecutable = (Resolve-Path -LiteralPath $AppExecutable).Path
$resolvedAppRoot = (Resolve-Path -LiteralPath $AppRoot).Path
New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null

$launcherSourcePath = Join-Path $PSScriptRoot 'native-host-launcher.cs'
$launcherSource = Get-Content -LiteralPath $launcherSourcePath -Raw
$launcherHash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($launcherSource))).Replace('-', '').ToLowerInvariant().Substring(0, 12)
$launcherPath = Join-Path $manifestDirectory "locky-native-host-$launcherHash.exe"
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) {
  $compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compilerPath)) { throw 'No se encontró el compilador C# de Windows.' }
if (-not (Test-Path -LiteralPath $launcherPath)) {
  & $compilerPath /nologo /target:exe "/out:$launcherPath" $launcherSourcePath
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el host de mensajería nativa de Locky.' }
}
$windowMonitorSourcePath = Join-Path $PSScriptRoot 'browser-window-monitor.cs'
$windowMonitorPath = Join-Path $manifestDirectory 'browser-window-monitor.exe'
& $compilerPath /nologo /target:exe "/out:$windowMonitorPath" $windowMonitorSourcePath
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el detector de ventanas de navegador de Locky.' }

$configurationKey = 'HKCU:\Software\LockyDesktop\NativeHost'
New-Item -Path $configurationKey -Force | Out-Null
New-ItemProperty -LiteralPath $configurationKey -Name 'AppExecutable' -Value $resolvedAppExecutable -PropertyType String -Force | Out-Null
New-ItemProperty -LiteralPath $configurationKey -Name 'AppRoot' -Value $resolvedAppRoot -PropertyType String -Force | Out-Null

$chromiumManifest = @{
  name = $hostName
  description = 'Locky Desktop browser connection'
  path = $launcherPath
  type = 'stdio'
  allowed_origins = @("chrome-extension://$chromiumExtensionId/")
}
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($manifestPath, ($chromiumManifest | ConvertTo-Json -Depth 4), $utf8WithoutBom)
$firefoxManifestPath = Join-Path $manifestDirectory "$hostName-firefox.json"
$firefoxManifest = @{
  name = $hostName
  description = 'Locky Desktop browser connection'
  path = $launcherPath
  type = 'stdio'
  allowed_extensions = @($firefoxExtensionId)
}
[System.IO.File]::WriteAllText($firefoxManifestPath, ($firefoxManifest | ConvertTo-Json -Depth 4), $utf8WithoutBom)

$registrations = @(
  'Software\Google\Chrome\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser\NativeMessagingHosts',
  'Software\Microsoft\Edge\NativeMessagingHosts',
  'Software\Mozilla\NativeMessagingHosts'
)
foreach ($relativeKey in $registrations) {
  $keyPath = "HKCU:\$relativeKey\$hostName"
  New-Item -Path $keyPath -Force | Out-Null
  Set-Item -LiteralPath $keyPath -Value $(if ($relativeKey -eq 'Software\Mozilla\NativeMessagingHosts') { $firefoxManifestPath } else { $manifestPath })
}

$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-Item -Path $runKey -Force | Out-Null
$startupCommand = '"{0}" "{1}" --background' -f $resolvedAppExecutable, $resolvedAppRoot
New-ItemProperty -LiteralPath $runKey -Name 'LockyDesktop' -Value $startupCommand -PropertyType String -Force | Out-Null

$chromiumPolicies = @(
  @{ Browser = 'Google\Chrome'; Name = 'IncognitoModeAvailability' },
  @{ Browser = 'BraveSoftware\Brave-Browser'; Name = 'IncognitoModeAvailability' },
  @{ Browser = 'Microsoft\Edge'; Name = 'InPrivateModeAvailability' }
)
foreach ($policy in $chromiumPolicies) {
  $policyPath = "HKCU:\Software\Policies\$($policy.Browser)"
  New-Item -Path $policyPath -Force | Out-Null
  New-ItemProperty -LiteralPath $policyPath -Name $policy.Name -Value 1 -PropertyType DWord -Force | Out-Null
}

$firefoxPolicyPath = 'HKCU:\Software\Policies\Mozilla\Firefox'
New-Item -Path $firefoxPolicyPath -Force | Out-Null
New-ItemProperty -LiteralPath $firefoxPolicyPath -Name 'PrivateBrowsingModeAvailability' -Value 1 -PropertyType DWord -Force | Out-Null

Write-Output 'Native messaging and private-browsing policies are configured for Chrome, Brave, Edge, and Firefox.'
Write-Output 'Install the unpacked Chromium extension from extensions/chromium in Chrome, Brave, and Edge.'
Write-Output 'Firefox requires loading extensions/firefox/manifest.json as a temporary add-on from about:debugging after each browser restart.'
Write-Output 'Opera is not configured or declared protected.'
