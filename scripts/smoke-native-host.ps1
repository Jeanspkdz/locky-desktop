$ErrorActionPreference = 'Stop'
$registrationKey = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.locky.desktop'
$manifestPath = if (Test-Path -LiteralPath $registrationKey) { (Get-Item -LiteralPath $registrationKey).GetValue('') }
if ([string]::IsNullOrWhiteSpace($manifestPath) -or -not (Test-Path -LiteralPath $manifestPath)) {
  throw 'Native host is not registered. Run pnpm setup:dev first.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $manifest.path)) {
  throw 'Registered native host executable is missing. Run pnpm setup:dev again.'
}

$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = $manifest.path
$start.Arguments = [string]$manifest.allowed_origins[0]
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardInput = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$process = [System.Diagnostics.Process]::Start($start)
$stderrTask = $process.StandardError.ReadToEndAsync()

try {
  $request = '{"id":1,"type":"getState","offset":0,"limit":0}'
  $payload = [System.Text.Encoding]::UTF8.GetBytes($request)
  $header = [System.BitConverter]::GetBytes([uint32]$payload.Length)
  $stdin = $process.StandardInput.BaseStream
  $stdin.Write($header, 0, $header.Length)
  $stdin.Write($payload, 0, $payload.Length)
  $stdin.Flush()

  $stdout = $process.StandardOutput.BaseStream
  $responseHeader = New-Object byte[] 4
  $readTask = $stdout.ReadAsync($responseHeader, 0, $responseHeader.Length)
  if (-not $readTask.Wait(20000)) {
    throw 'Native host did not answer within 20 seconds.'
  }
  if ($readTask.Result -ne 4) {
    throw 'Native host returned an incomplete response header.'
  }

  $responseLength = [System.BitConverter]::ToUInt32($responseHeader, 0)
  if ($responseLength -gt 1048576) {
    throw 'Native host response exceeds the supported message size.'
  }
  $responseBytes = New-Object byte[] $responseLength
  $offset = 0
  while ($offset -lt $responseLength) {
    $read = $stdout.Read($responseBytes, $offset, $responseLength - $offset)
    if ($read -eq 0) { throw 'Native host response ended before its payload.' }
    $offset += $read
  }

  $response = [System.Text.Encoding]::UTF8.GetString($responseBytes) | ConvertFrom-Json
  if ($response.ok -ne $true -or $response.type -ne 'state') {
    throw 'Native host returned an invalid state response.'
  }
  Write-Output ('Native host OK; rules={0}; clockReady={1}' -f $response.totalRules, $response.clockReady)
}
finally {
  $process.StandardInput.Close()
  if (-not $process.WaitForExit(3000)) { $process.Kill() }
}
