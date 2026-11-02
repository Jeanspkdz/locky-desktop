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

$runningCopies = Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -and [System.StringComparer]::OrdinalIgnoreCase.Equals($_.ExecutablePath, $appExecutable)
}
foreach ($process in $runningCopies) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
Get-ChildItem -LiteralPath $packageRoot -Force | Copy-Item -Destination $installRoot -Recurse -Force

& $registrationScript -AppExecutable $appExecutable -AppRoot $appRoot
Start-Process -FilePath $appExecutable -ArgumentList "`"$appRoot`"" -WorkingDirectory $installRoot

Write-Output "Locky quedó instalado en: $installRoot"
Write-Output 'Carga extensions/chromium como complemento desempaquetado en Chrome, Brave y Edge.'
Write-Output 'Carga resources/locky/firefox/manifest.json como complemento temporal en Firefox; vuelve a cargarlo después de reiniciar Firefox.'
Write-Output 'Para reparar la integración, vuelve a ejecutar este instalador como administrador.'
