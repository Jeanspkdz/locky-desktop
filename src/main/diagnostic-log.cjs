const fs = require('node:fs');
const path = require('node:path');

const MAX_LOG_BYTES = 256 * 1024;

function createDiagnosticLogger(filePath, { now = () => new Date() } = {}) {
  const previousLogPath = `${filePath}.1`;

  return Object.freeze({
    error(event, error) {
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const detail = error instanceof Error ? error.stack ?? error.message : String(error);
        const entry = `${now().toISOString()} ${event}: ${detail}\n`;
        const currentSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        if (currentSize + Buffer.byteLength(entry, 'utf8') > MAX_LOG_BYTES) {
          fs.rmSync(previousLogPath, { force: true });
          if (fs.existsSync(filePath)) fs.renameSync(filePath, previousLogPath);
        }
        fs.appendFileSync(filePath, entry, 'utf8');
      } catch {
        // Logging must not stop browser monitoring or application startup.
      }
    },
  });
}

module.exports = { createDiagnosticLogger };
