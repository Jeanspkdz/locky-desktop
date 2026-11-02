param([Parameter(Mandatory=$true)][string]$Executable, [Parameter(Mandatory=$true)][string]$Icon)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class IconResource {
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern IntPtr BeginUpdateResource(string file, bool deleteExisting);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool UpdateResource(IntPtr handle, IntPtr type, IntPtr name, ushort language, byte[] data, uint size);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool EndUpdateResource(IntPtr handle, bool discard);
}
'@
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Icon).Path)
if ([BitConverter]::ToUInt16($bytes, 0) -ne 0 -or [BitConverter]::ToUInt16($bytes, 2) -ne 1 -or [BitConverter]::ToUInt16($bytes, 4) -ne 1) { throw 'Se requiere un icono ICO de una imagen.' }
$length = [BitConverter]::ToInt32($bytes, 14)
$offset = [BitConverter]::ToInt32($bytes, 18)
$image = [byte[]]::new($length)
[Array]::Copy($bytes, $offset, $image, 0, $length)
$group = [byte[]]::new(20)
[Array]::Copy($bytes, 0, $group, 0, 18)
[Array]::Copy([BitConverter]::GetBytes([uint16]1), 0, $group, 18, 2)
$handle = [IconResource]::BeginUpdateResource((Resolve-Path -LiteralPath $Executable).Path, $false)
if ($handle -eq [IntPtr]::Zero) { throw "No se pudo abrir el ejecutable: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
$success = $false
try {
  if (-not [IconResource]::UpdateResource($handle, [IntPtr]3, [IntPtr]1, 0, $image, $image.Length)) { throw 'No se pudo escribir RT_ICON.' }
  if (-not [IconResource]::UpdateResource($handle, [IntPtr]14, [IntPtr]1, 0, $group, $group.Length)) { throw 'No se pudo escribir RT_GROUP_ICON.' }
  $success = $true
} finally {
  if (-not [IconResource]::EndUpdateResource($handle, -not $success)) { throw 'No se pudo guardar el icono del ejecutable.' }
}
