param(
  [string]$OutputDirectory = "dist/win-unpacked"
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
$distPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist'))

if (-not $outputPath.StartsWith($distPath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "El directorio de salida debe estar dentro de '$distPath'."
}
if (Test-Path -LiteralPath $outputPath) {
  throw "El directorio de salida ya existe; no se sobrescribirá: $outputPath"
}

$electronDist = Join-Path $projectRoot 'node_modules/electron/dist'
if (-not (Test-Path -LiteralPath (Join-Path $electronDist 'electron.exe'))) {
  throw 'No se encontró Electron. Ejecuta pnpm install antes de empaquetar.'
}
$koffiEntry = (& node -e "process.stdout.write(require.resolve('koffi'))")
if ($LASTEXITCODE -ne 0 -or -not $koffiEntry) {
  throw 'No se encontró Koffi. Ejecuta pnpm install antes de empaquetar.'
}
$koffiPackagePath = Split-Path -Parent $koffiEntry
$nodeArchitecture = (& node -p "process.arch").Trim()
$nativePackageName = "koffi-win32-$nodeArchitecture"
$nativePackagePath = Join-Path (Split-Path -Parent $koffiPackagePath) "@koromix/$nativePackageName"
if (-not (Test-Path -LiteralPath (Join-Path $nativePackagePath 'win32_x64/koffi.node')) -and
    -not (Test-Path -LiteralPath (Join-Path $nativePackagePath 'win32_arm64/koffi.node')) -and
    -not (Test-Path -LiteralPath (Join-Path $nativePackagePath 'win32_ia32/koffi.node'))) {
  throw "No se encontró el binario nativo de Koffi para la arquitectura del paquete: $nativePackagePath"
}

$requiredPaths = @(
  'src',
  'extensions/chromium',
  'extensions/firefox',
  'install/windows/native-host-launcher.cs',
  'install/windows/browser-window-monitor.cs',
  'install/windows/register-browser-hosts.ps1',
  'scripts/install-windows.ps1',
  'scripts/create-icon.ps1',
  'package.json',
  'assets/locky.svg',
  'assets/locky.png',
  'assets/locky.ico'
)
foreach ($relativePath in $requiredPaths) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relativePath))) {
    throw "Falta un componente requerido para el paquete: $relativePath"
  }
}

& (Join-Path $PSScriptRoot 'create-icon.ps1')

$resourcesPath = Join-Path $outputPath 'resources'
$appPath = Join-Path $resourcesPath 'app'
$lockyPath = Join-Path $resourcesPath 'locky'
$appNodeModules = Join-Path $appPath 'node_modules'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
Get-ChildItem -LiteralPath $electronDist | Copy-Item -Destination $outputPath -Recurse
Rename-Item -LiteralPath (Join-Path $outputPath 'electron.exe') -NewName 'Locky Desktop.exe'
& (Join-Path $PSScriptRoot 'set-exe-icon.ps1') -Executable (Join-Path $outputPath 'Locky Desktop.exe') -Icon (Join-Path $projectRoot 'assets/locky.ico')
New-Item -ItemType Directory -Path $appPath, $lockyPath -Force | Out-Null

$appKoffiPath = Join-Path $appNodeModules 'koffi'
$appKoffiNativePath = Join-Path $appNodeModules "@koromix/$nativePackageName"
New-Item -ItemType Directory -Path $appNodeModules, (Split-Path -Parent $appKoffiNativePath) -Force | Out-Null
Copy-Item -LiteralPath $koffiPackagePath -Destination $appKoffiPath -Recurse
Copy-Item -LiteralPath $nativePackagePath -Destination $appKoffiNativePath -Recurse

Copy-Item -LiteralPath (Join-Path $projectRoot 'src') -Destination $appPath -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'package.json') -Destination $appPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/locky.png') -Destination (Join-Path $lockyPath 'icon.png')
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets/locky.ico') -Destination (Join-Path $lockyPath 'icon.ico')
Copy-Item -LiteralPath (Join-Path $projectRoot 'extensions/chromium') -Destination (Join-Path $lockyPath 'chromium') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'extensions/firefox') -Destination (Join-Path $lockyPath 'firefox') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'install/windows/register-browser-hosts.ps1') -Destination $lockyPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'install/windows/native-host-launcher.cs') -Destination $lockyPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'install/windows/browser-window-monitor.cs') -Destination $lockyPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'scripts/install-windows.ps1') -Destination (Join-Path $outputPath 'Install-Locky.ps1')
New-Item -ItemType File -Path (Join-Path $lockyPath 'installed.flag') | Out-Null

Write-Host "Paquete portable creado en: $outputPath"
Write-Host "Instalador administrativo: $(Join-Path $outputPath 'Install-Locky.ps1')"
