$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$electronExecutable = Join-Path $projectRoot 'node_modules/electron/dist/electron.exe'
$registrationScript = Join-Path $projectRoot 'install/windows/register-browser-hosts.ps1'

if (-not (Test-Path -LiteralPath $electronExecutable)) {
  $electronPackage = Join-Path $projectRoot 'node_modules/electron/package.json'
  if (-not (Test-Path -LiteralPath $electronPackage)) {
    throw 'No se encontró el paquete Electron. Ejecuta pnpm install antes de configurar Locky.'
  }

  Push-Location $projectRoot
  try {
    & pnpm exec install-electron
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo descargar el ejecutable de Electron (pnpm salió con código $LASTEXITCODE)."
    }
  }
  finally {
    Pop-Location
  }

  if (-not (Test-Path -LiteralPath $electronExecutable)) {
    throw 'La descarga de Electron terminó, pero no se encontró node_modules/electron/dist/electron.exe.'
  }
}

& $registrationScript -AppExecutable $electronExecutable -AppRoot $projectRoot

[Environment]::SetEnvironmentVariable('LOCKY_ENFORCE_UNHEALTHY_BROWSER', $null, 'User')
Write-Output 'Locky se iniciará al iniciar sesión y mostrará reparaciones sin cerrar navegadores en desarrollo.'
Write-Output 'Carga la extensión Chromium sin empaquetar en Chrome, Brave y Edge antes de volver a abrir esos navegadores.'
Write-Output 'En Firefox, carga la extensión temporalmente desde about:debugging; tendrás que repetirlo después de reiniciarlo.'
Write-Output 'Cierra y vuelve a abrir Locky y los navegadores para que se apliquen las políticas y el modo de protección.'
