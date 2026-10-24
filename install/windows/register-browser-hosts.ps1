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

New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
$chromiumManifest = @{
  name = $hostName
  description = 'Locky Desktop browser connection'
  path = (Resolve-Path -LiteralPath $AppExecutable).Path
  type = 'stdio'
  args = @('--native-host')
  allowed_origins = @("chrome-extension://$chromiumExtensionId/")
}
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($manifestPath, ($chromiumManifest | ConvertTo-Json -Depth 4), $utf8WithoutBom)
$firefoxManifestPath = Join-Path $manifestDirectory "$hostName-firefox.json"
$firefoxManifest = @{
  name = $hostName
  description = 'Locky Desktop browser connection'
  path = (Resolve-Path -LiteralPath $AppExecutable).Path
  type = 'stdio'
  args = @('--native-host')
  allowed_extensions = @($firefoxExtensionId)
}
[System.IO.File]::WriteAllText($firefoxManifestPath, ($firefoxManifest | ConvertTo-Json -Depth 4), $utf8WithoutBom)

$registrations = @(
  'Software\Google\Chrome\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser\NativeMessagingHosts',
  'Software\Microsoft\Edge\NativeMessagingHosts',
  'Software\Opera Software\Opera Stable\NativeMessagingHosts',
  'Software\Opera Software\Opera GX Stable\NativeMessagingHosts',
  'Software\Mozilla\NativeMessagingHosts'
)
foreach ($relativeKey in $registrations) {
  $keyPath = "HKCU:\$relativeKey\$hostName"
  New-Item -Path $keyPath -Force | Out-Null
  Set-Item -LiteralPath $keyPath -Value $(if ($relativeKey -eq 'Software\Mozilla\NativeMessagingHosts') { $firefoxManifestPath } else { $manifestPath })
}

$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -LiteralPath $runKey -Name 'LockyDesktop' -Value "`"$((Resolve-Path -LiteralPath $AppExecutable).Path)`"" -PropertyType String -Force | Out-Null

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

Write-Output 'Private-browsing policies set for Chrome, Brave, Edge, and Firefox; native messaging entries were written for all listed browsers.'
Write-Output 'The Firefox extension must still be installed through a signed package or a development profile.'
Write-Output 'Install the Chromium extension in Chrome, Brave, Edge, and each Opera variant from its extensions page.'
Write-Output 'Opera native messaging and private-mode policies are not verified; do not treat Opera as protected yet.'
