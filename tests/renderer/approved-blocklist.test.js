import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

class Element {
  constructor() {
    this.children = [];
    this.textContent = '';
    this.hidden = false;
    this.classList = { toggle() {} };
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
  setAttribute() {}
  closest() { return new Element(); }
}

test('approved initial domains show protection without an approval action', async () => {
  const html = readFileSync(new URL('../../src/renderer/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /approve-candidates|candidate-panel|candidate-list/);

  const ids = [
    'rule-form', 'rule-type', 'rule-value', 'form-error', 'pending-list',
    'browser-health', 'status', 'simulate',
  ];
  const elements = new Map(ids.map(id => [`#${id}`, new Element()]));
  elements.get('#rule-type').value = 'domain';
  let stateChanged;
  const state = {
    ruleCount: 129,
    pendingRules: [],
    browserHealth: {
      chrome: { status: 'healthy' },
      edge: { status: 'healthy' },
      brave: { status: 'healthy' },
    },
  };
  const context = {
    document: {
      querySelector: selector => elements.get(selector),
      createElement: () => new Element(),
    },
    window: {
      locky: {
        getState: async () => state,
        isPackaged: async () => true,
        onStateChanged: callback => { stateChanged = callback; },
      },
    },
    performance: { now: () => 0 },
    setInterval() {},
  };

  vm.runInNewContext(readFileSync(new URL('../../src/renderer/renderer.js', import.meta.url), 'utf8'), context);
  stateChanged(state);
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(elements.get('#status').textContent, 'Protección activa');
  assert.equal(elements.has('#approve-candidates'), false);
});
