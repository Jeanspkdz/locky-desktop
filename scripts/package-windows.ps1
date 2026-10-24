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

$requiredPaths = @(
  'src',
  'extensions/chromium',
  'extensions/firefox',
  'install/windows/register-browser-hosts.ps1',
  'package.json'
)
foreach ($relativePath in $requiredPaths) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relativePath))) {
    throw "Falta un componente requerido para el paquete: $relativePath"
  }
}

$resourcesPath = Join-Path $outputPath 'resources'
$appPath = Join-Path $resourcesPath 'app'
$lockyPath = Join-Path $resourcesPath 'locky'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
Get-ChildItem -LiteralPath $electronDist | Copy-Item -Destination $outputPath -Recurse
Rename-Item -LiteralPath (Join-Path $outputPath 'electron.exe') -NewName 'Locky Desktop.exe'
New-Item -ItemType Directory -Path $appPath, $lockyPath -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot 'src') -Destination $appPath -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'package.json') -Destination $appPath
Copy-Item -LiteralPath (Join-Path $projectRoot 'extensions/chromium') -Destination (Join-Path $lockyPath 'chromium') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'extensions/firefox') -Destination (Join-Path $lockyPath 'firefox') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'install/windows/register-browser-hosts.ps1') -Destination $lockyPath
New-Item -ItemType File -Path (Join-Path $lockyPath 'installed.flag') | Out-Null

Write-Host "Paquete portable creado en: $outputPath"
Write-Host 'Este paso no instala extensiones ni cambia políticas de Windows.'
