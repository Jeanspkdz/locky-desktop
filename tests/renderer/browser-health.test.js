import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

class Element {
  constructor() {
    this.children = [];
    this.textContent = '';
    this.className = '';
    this.classList = { toggle() {} };
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
  setAttribute() {}
  closest() { return new Element(); }
}

test('Brave overlay failures display a permission-level hint in the settings UI', () => {
  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    createElement: () => new Element(),
  };
  const state = {
    ruleCount: 1,
    pendingRules: [],
    clockNow: 10_000,
    enforcementEnabled: false,
    browserHealth: { brave: { status: 'repair', reason: 'overlay' } },
  };
  let stateChanged;
  const context = {
    document,
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

  const braveRow = elements.get('#browser-health').children.find(row => row.children[0].textContent === 'B');
  const status = braveRow.children[1].children[1].textContent;
  assert.match(status, /no pudo cubrir la ventana del navegador/i);
  assert.match(status, /mismo nivel de permisos que Locky/i);
});
