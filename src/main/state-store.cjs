const fs = require('node:fs/promises');
const path = require('node:path');

const EMPTY_STATE = Object.freeze({
  version: 1,
  revision: 0,
  rulesRevision: 0,
  rules: [],
  pendingRules: [],
  desktopLock: null,
  candidateListApproved: false,
  candidateListApprovedAt: null,
  candidateList: [],
  candidateListCheckedAt: null,
  browserHealth: {},
});

class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async read() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        ...EMPTY_STATE,
        ...parsed,
        revision: Number.isSafeInteger(parsed.revision) ? parsed.revision : 0,
        rulesRevision: Number.isSafeInteger(parsed.rulesRevision) ? parsed.rulesRevision : 0,
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        pendingRules: Array.isArray(parsed.pendingRules) ? parsed.pendingRules : [],
        candidateList: Array.isArray(parsed.candidateList) ? parsed.candidateList : [],
        browserHealth: parsed.browserHealth && typeof parsed.browserHealth === 'object' ? parsed.browserHealth : {},
      };
    } catch (error) {
      if (error.code === 'ENOENT') return structuredClone(EMPTY_STATE);
      if (error instanceof SyntaxError) throw new Error('El archivo de estado de Locky está dañado; no se descartaron las reglas guardadas.', { cause: error });
      throw error;
    }
  }

  async write(state) {
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
      await fs.rename(temporaryPath, this.filePath);
    });
    return this.writeQueue;
  }
}

module.exports = { StateStore, EMPTY_STATE };
