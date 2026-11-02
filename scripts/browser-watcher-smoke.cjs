const { createWindowsBrowserWatcher } = require('../src/main/windows-browser-watcher.cjs');

const watcher = createWindowsBrowserWatcher();
const timings = [];
const cpuStarted = process.cpuUsage();
let snapshot;
for (let index = 0; index < 100; index += 1) {
  const startedAt = performance.now();
  snapshot = watcher.snapshot();
  timings.push(performance.now() - startedAt);
}
timings.sort((left, right) => left - right);
const cpu = process.cpuUsage(cpuStarted);
const cpuMsPerSnapshot = (cpu.user + cpu.system) / 1000 / timings.length;

const supportedFamilies = new Set(['chrome', 'edge', 'brave', 'firefox', 'opera']);
if (snapshot.windows.some(window => !supportedFamilies.has(window.family))) {
  throw new Error('El vigilante devolvió una familia de navegador desconocida.');
}
if (snapshot.windows.some(window => !snapshot.families.includes(window.family))) {
  throw new Error('La familia de una ventana detectada no aparece entre los navegadores abiertos.');
}

console.log(JSON.stringify({
  samples: timings.length,
  medianMs: Number(timings[49].toFixed(3)),
  p95Ms: Number(timings[94].toFixed(3)),
  maxMs: Number(timings[99].toFixed(3)),
  cpuMsPerSnapshot: Number(cpuMsPerSnapshot.toFixed(3)),
  estimatedSingleCorePercentAt500ms: Number((cpuMsPerSnapshot / 500 * 100).toFixed(3)),
  runningFamilies: snapshot.families,
  windows: snapshot.windows.map(({ id, family, x, y, width, height, visible, minimized, foreground }) => ({
    id, family, x, y, width, height, visible, minimized, foreground,
  })),
}, null, 2));
