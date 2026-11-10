param(
  [string]$PackageDirectory,
  [string]$InstallDirectory = (Join-Path $env:ProgramFiles 'Locky Desktop'),
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($PackageDirectory)) {
  if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'resources/locky/installed.flag')) {
    $PackageDirectory = $PSScriptRoot
  } else {
    $PackageDirectory = Join-Path $PSScriptRoot '..\dist\win-unpacked'
  }
}

$packageRoot = (Resolve-Path -LiteralPath $PackageDirectory).Path
$programFilesRoot = [System.IO.Path]::GetFullPath($env:ProgramFiles).TrimEnd('\')
$installRoot = [System.IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
$requiredPackageFiles = @(
  'Locky Desktop.exe',
  'resources/app/package.json',
  'resources/app/src/main.cjs',
  'resources/locky/installed.flag',
  'resources/locky/icon.ico',
  'resources/locky/locky-brand.ico',
  'resources/locky/native-host-launcher.cs',
  'resources/locky/register-browser-hosts.ps1'
)

foreach ($relativePath in $requiredPackageFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $relativePath))) {
    throw "El paquete está incompleto. Falta: $relativePath"
  }
}

if (-not $installRoot.StartsWith($programFilesRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "La instalación debe quedar dentro de '$programFilesRoot'."
}

if ($ValidateOnly) {
  Write-Output "Paquete válido: $packageRoot"
  Write-Output "Destino previsto: $installRoot"
  return
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Ejecuta Install-Locky.ps1 desde PowerShell como administrador y con la misma cuenta de Windows que usa Locky.'
}

$appExecutable = Join-Path $installRoot 'Locky Desktop.exe'
$appRoot = Join-Path $installRoot 'resources/app'
$registrationScript = Join-Path $installRoot 'resources/locky/register-browser-hosts.ps1'

$nativeManifestPaths = @(
  (Join-Path $env:LOCALAPPDATA 'LockyDesktop/com.locky.desktop.json'),
  (Join-Path $env:LOCALAPPDATA 'LockyDesktop/com.locky.desktop-firefox.json'),
  (Join-Path $installRoot 'resources/locky/com.locky.desktop.json'),
  (Join-Path $installRoot 'resources/locky/com.locky.desktop-firefox.json')
)
$stashedManifests = [System.Collections.Generic.List[object]]::new()
$registrationCompleted = $false
try {
  foreach ($manifestPath in $nativeManifestPaths) {
    if (-not (Test-Path -LiteralPath $manifestPath)) { continue }
    $disabledPath = "$manifestPath.install-$([Guid]::NewGuid().ToString('N'))"
    Move-Item -LiteralPath $manifestPath -Destination $disabledPath
    $stashedManifests.Add([pscustomobject]@{ Original = $manifestPath; Disabled = $disabledPath })
  }

  $nativeHosts = @(Get-Process -Name 'locky-native-host*' -ErrorAction SilentlyContinue)
  foreach ($hostProcess in $nativeHosts) {
    Stop-Process -Id $hostProcess.Id -Force -ErrorAction SilentlyContinue
  }
  $hostStopDeadline = (Get-Date).AddSeconds(15)
  do {
    $nativeHosts = @(Get-Process -Name 'locky-native-host*' -ErrorAction SilentlyContinue)
    if ($nativeHosts.Count -eq 0) { break }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $hostStopDeadline)
  if ($nativeHosts.Count -gt 0) {
    throw 'El host nativo sigue ejecutándose; no se copiarán archivos durante la actualización.'
  }

  $processName = [System.IO.Path]::GetFileNameWithoutExtension($appExecutable)
  $runningCopies = @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
  foreach ($process in $runningCopies) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  $stopDeadline = (Get-Date).AddSeconds(15)
  do {
    $runningCopies = @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
    if ($runningCopies.Count -eq 0) { break }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $stopDeadline)
  if ($runningCopies.Count -gt 0) {
    throw 'Locky sigue ejecutándose; no se copiarán archivos sobre la app abierta.'
  }

  # An earlier local setup launches Locky through electron.exe. That process can
  # keep the single-instance lock and leave the old settings window on screen.
  $projectRoot = Split-Path -Parent (Split-Path -Parent $packageRoot)
  $sourceMain = Join-Path $projectRoot 'src/main.cjs'
  if (Test-Path -LiteralPath $sourceMain) {
    $sourceElectron = Join-Path $projectRoot 'node_modules/electron/dist/electron.exe'
    $sourceProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" |
      Where-Object { $_.ExecutablePath -eq $sourceElectron -and $_.CommandLine -like "*$projectRoot*" })
    foreach ($process in $sourceProcesses) {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Milliseconds 500

  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $packageRoot -Force | Copy-Item -Destination $installRoot -Recurse -Force

  & $registrationScript -AppExecutable $appExecutable -AppRoot $appRoot

  $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Locky Desktop.lnk'
  if (Test-Path -LiteralPath $desktopShortcut) {
    $shortcutShell = New-Object -ComObject WScript.Shell
    $shortcut = $shortcutShell.CreateShortcut($desktopShortcut)
    $shortcut.TargetPath = $appExecutable
    $shortcut.Arguments = '"{0}"' -f $appRoot
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.IconLocation = Join-Path $installRoot 'resources/locky/locky-brand.ico'
    $shortcut.Description = 'Locky Desktop'
    $shortcut.Save()
  }

  $registrationCompleted = $true
} finally {
  foreach ($manifest in $stashedManifests) {
    if ($registrationCompleted) {
      Remove-Item -LiteralPath $manifest.Disabled -Force -ErrorAction SilentlyContinue
      continue
    }
    if (Test-Path -LiteralPath $manifest.Original) {
      Remove-Item -LiteralPath $manifest.Original -Force -ErrorAction SilentlyContinue
    }
    Move-Item -LiteralPath $manifest.Disabled -Destination $manifest.Original -ErrorAction SilentlyContinue
  }
}

$explorerPath = Join-Path $env:WINDIR 'explorer.exe'
$launchArguments = '"{0}" "{1}"' -f $appExecutable, $appRoot
Start-Process -FilePath $explorerPath -ArgumentList $launchArguments -WorkingDirectory $installRoot -WindowStyle Hidden

Write-Output "Locky quedó instalado en: $installRoot"
Write-Output 'Locky se inició desde Explorer como usuario normal para mantener el acceso al host nativo de los navegadores.'
$chromiumExtensionPath = Join-Path $installRoot 'resources/locky/chromium'
$firefoxManifestPath = Join-Path $installRoot 'resources/locky/firefox/manifest.json'
Write-Output "Carga la extensión Chromium sin empaquetar desde: $chromiumExtensionPath"
Write-Output "Carga $firefoxManifestPath como complemento temporal en Firefox; vuelve a cargarlo después de reiniciar Firefox."
Write-Output 'Para reparar la integración, vuelve a ejecutar este instalador como administrador.'
