param(
  [string] $PackageDirectory,
  [string] $InstallDirectory = (Join-Path $env:ProgramFiles 'Locky Desktop')
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($PackageDirectory)) {
  if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'Locky Desktop.exe')) {
    $PackageDirectory = $PSScriptRoot
  } else {
    $PackageDirectory = Join-Path $PSScriptRoot '..\dist\win-unpacked'
  }
}
$packageRoot = (Resolve-Path -LiteralPath $PackageDirectory).Path
$installRoot = [System.IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
$programFilesRoot = [System.IO.Path]::GetFullPath($env:ProgramFiles).TrimEnd('\')
if (-not $installRoot.StartsWith($programFilesRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw "The shared application must be installed under '$programFilesRoot'."
}
$required = @(
  'Locky Desktop.exe',
  'resources/app/package.json',
  'resources/locky/dns-protection/Install-DnsProtection.ps1',
  'resources/locky/dns-protection/ProtectionService.cs'
)
foreach ($relativePath in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $relativePath))) { throw "Package file missing: $relativePath" }
}
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this installer elevated with administrator credentials.' }
if (Test-Path -LiteralPath (Join-Path $installRoot 'Locky Desktop.exe')) {
  throw 'A Locky installation already exists. Use Install-Locky.ps1 to repair or update it.'
}

New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
Get-ChildItem -LiteralPath $packageRoot -Force | Copy-Item -Destination $installRoot -Recurse -Force
$dnsInstaller = Join-Path $installRoot 'resources/locky/dns-protection/Install-DnsProtection.ps1'
& $dnsInstaller -InstallDirectory (Join-Path $installRoot 'resources/locky/dns-protection')
if ($LASTEXITCODE -ne 0) { throw 'Could not install the system DNS protection.' }

$commonDesktop = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonDesktopDirectory)
$shortcutPath = Join-Path $commonDesktop 'Locky Desktop.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $installRoot 'Locky Desktop.exe'
$shortcut.Arguments = '"{0}"' -f (Join-Path $installRoot 'resources/app')
$shortcut.WorkingDirectory = $installRoot
$shortcut.Description = 'Locky Desktop'
$shortcut.Save()
Write-Output "Locky is installed for standard users at $installRoot. Launch it from the shared desktop shortcut."
