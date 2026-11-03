import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extensionManifest = JSON.parse(readFileSync(path.join(projectRoot, 'extensions/chromium/manifest.json'), 'utf8'));
const registrationScript = readFileSync(path.join(projectRoot, 'install/windows/register-browser-hosts.ps1'), 'utf8');
const setupScript = readFileSync(path.join(projectRoot, 'scripts/setup-dev.ps1'), 'utf8');
const installerScript = readFileSync(path.join(projectRoot, 'scripts/install-windows.ps1'), 'utf8');

function extensionIdFromPublicKey(key) {
  const digest = createHash('sha256').update(Buffer.from(key, 'base64')).digest().subarray(0, 16);
  return [...digest].map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 0x0f))).join('');
}

function queryRegistryValue(keyPath, valueName = null) {
  try {
    const args = ['query', keyPath, ...(valueName ? ['/v', valueName] : ['/ve'])];
    const output = execFileSync('reg.exe', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const valuePattern = valueName ? new RegExp(`^\\s*${valueName}\\s+REG_SZ\\s+(.+)$`, 'im') : /\(Default\)\s+REG_SZ\s+(.+)$/im;
    return output.match(valuePattern)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

test('Brave registration uses the stable Chromium extension ID and repeatable registry writes', () => {
  const extensionId = extensionIdFromPublicKey(extensionManifest.key);
  assert.equal(extensionId, 'pgphggplmacpiglkndjhpaojeeoomfdn');
  assert.match(registrationScript, new RegExp(`\\$chromiumExtensionId = '${extensionId}'`));
  assert.match(registrationScript, /Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts/);
  assert.match(registrationScript, /allowed_origins = @\("chrome-extension:\/\/\$chromiumExtensionId\/"\)/);
  assert.match(registrationScript, /New-Item -Path \$keyPath -Force/);
  assert.match(registrationScript, /Set-Item -LiteralPath \$keyPath -Value/);
  assert.match(registrationScript, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(registrationScript, /Register-ScheduledTask -TaskName \$startupTaskName/);
  assert.match(registrationScript, /Remove-ItemProperty -LiteralPath \$runKey -Name 'LockyDesktop'/);
  assert.match(registrationScript, /SHA256.*launcherSource/);
  assert.match(setupScript, /register-browser-hosts\.ps1/);
  assert.match(installerScript, /register-browser-hosts\.ps1/);
});

test('the current Brave native-messaging and Windows login registrations resolve to real files', t => {
  if (process.platform !== 'win32') return t.skip('Windows registry verification only runs on Windows.');

  const base = 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\com.locky.desktop';
  const manifestPath = queryRegistryValue(base);
  if (!manifestPath) return t.skip('Brave native messaging is not installed in this test environment.');
  assert.equal(path.isAbsolute(manifestPath), true);
  const hostManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(path.dirname(manifestPath), path.dirname(hostManifest.path), 'the manifest and host executable must share an accessible installation directory');
  assert.equal(readFileSync(path.join(path.dirname(manifestPath), 'register-browser-hosts.ps1'), 'utf8').includes('$hostName = \'com.locky.desktop\''), true,
    'the manifest must live beside the registration script, outside the inaccessible per-user runtime directory');
  assert.equal(path.isAbsolute(hostManifest.path), true);
  assert.equal(hostManifest.type, 'stdio');
  assert.deepEqual(hostManifest.allowed_origins, [`chrome-extension://${extensionIdFromPublicKey(extensionManifest.key)}/`]);
  assert.equal(path.basename(manifestPath), 'com.locky.desktop.json');
  assert.equal(readFileSync(manifestPath, 'utf8').length > 0, true);
  assert.equal(execFileSync('powershell.exe', ['-NoProfile', '-Command', `Test-Path -LiteralPath '${hostManifest.path.replaceAll("'", "''")}'`], { encoding: 'utf8', windowsHide: true }).trim(), 'True');

  const startupTaskJson = execFileSync('powershell.exe', ['-NoProfile', '-Command', "$task = Get-ScheduledTask -TaskName 'LockyDesktop' -ErrorAction Stop; [pscustomobject]@{ Execute = $task.Actions[0].Execute; Arguments = $task.Actions[0].Arguments; WorkingDirectory = $task.Actions[0].WorkingDirectory; TriggerClass = $task.Triggers[0].CimClass.CimClassName; Delay = $task.Triggers[0].Delay; UserId = $task.Principal.UserId; LogonType = if ([int]$task.Principal.LogonType -eq 3) { 'Interactive' } else { [string]$task.Principal.LogonType }; RunLevel = if ([int]$task.Principal.RunLevel -eq 0) { 'Limited' } else { [string]$task.Principal.RunLevel }; RestartCount = $task.Settings.RestartCount; RestartInterval = $task.Settings.RestartInterval; StartWhenAvailable = $task.Settings.StartWhenAvailable } | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true });
  const startupTask = JSON.parse(startupTaskJson);
  const startupArguments = startupTask.Arguments.match(/^"([^"]+)" --background$/);
  assert.ok(startupArguments, 'the scheduled task passes the quoted app root and background flag');
  assert.equal(startupTask.WorkingDirectory, startupArguments[1]);
  assert.match(startupTask.TriggerClass, /LogonTrigger$/);
  assert.equal(startupTask.Delay, 'PT15S');
  assert.equal(startupTask.LogonType, 'Interactive');
  assert.equal(startupTask.RunLevel, 'Limited');
  assert.equal(startupTask.RestartCount, 3);
  assert.equal(startupTask.RestartInterval, 'PT1M');
  assert.equal(startupTask.StartWhenAvailable, true);
  assert.equal(queryRegistryValue('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', 'LockyDesktop'), null,
    'the previous Run entry is removed so Locky cannot launch twice');
  assert.equal(execFileSync('powershell.exe', ['-NoProfile', '-Command', `Test-Path -LiteralPath '${startupTask.Execute.replaceAll("'", "''")}'`], { encoding: 'utf8', windowsHide: true }).trim(), 'True');
});
