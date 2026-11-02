const { findBrowserRule, toBrowserRules } = globalThis.LockyRules;

const NATIVE_HOST = 'com.locky.desktop';
let nativePort;
let currentRules = [];
let requestSequence = 0;
let stateRequestId = null;
let stateRulesRevision = null;
let expectedRulesRevision = null;
let incomingRules = [];
let fetchingState = false;
let refreshAfterSync = false;
const seenAttempts = new Map();
const STATE_PAGE_SIZE = 500;

function getBrowserFamily() {
  const userAgent = navigator.userAgent;
  if (/Firefox\//.test(userAgent)) return 'firefox';
  if (/Edg\//.test(userAgent)) return 'edge';
  if (/OPR\//.test(userAgent) || /Opera\//.test(userAgent)) return 'opera';
  if (navigator.brave) return 'brave';
  return 'chrome';
}

function connectNative() {
  if (nativePort) return nativePort;
  try {
    nativePort = browser.runtime.connectNative(NATIVE_HOST);
    nativePort.onDisconnect.addListener(() => {
      nativePort = undefined;
      fetchingState = false;
      stateRequestId = null;
      setTimeout(() => { connectNative(); refreshState(); }, 3000);
    });
    nativePort.onMessage.addListener(message => {
      if (message.id !== stateRequestId) return;
      if (!message.ok || message.type !== 'state') {
        reportHealthFailure(message.error ?? 'No se pudo sincronizar el estado.');
        finishStateSync();
        return;
      }
      void handleStatePage(message);
    });
    return nativePort;
  } catch {
    nativePort = undefined;
    return undefined;
  }
}

function send(type, detail = {}) {
  const port = connectNative();
  if (!port) return;
  port.postMessage({ id: ++requestSequence, type, ...detail });
}

async function syncDynamicRules() {
  try {
    const browserRules = toBrowserRules(currentRules);
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map(rule => rule.id),
      addRules: browserRules,
    });
    send('health', { browserFamily: getBrowserFamily(), ok: true });
  } catch (error) {
    send('health', { browserFamily: getBrowserFamily(), ok: false, error: error.message });
  }
}

function requestStatePage(offset, limit) {
  if (!nativePort) return;
  stateRequestId = ++requestSequence;
  nativePort.postMessage({ id: stateRequestId, type: 'getState', offset, limit });
}

function finishStateSync() {
  fetchingState = false;
  stateRequestId = null;
  if (refreshAfterSync) {
    refreshAfterSync = false;
    refreshState();
  }
}

async function handleStatePage(message) {
  if (message.limit === 0) {
    if (stateRulesRevision === message.rulesRevision && currentRules.length === message.totalRules) {
      await verifyDynamicRules();
      finishStateSync();
      return;
    }
    expectedRulesRevision = message.rulesRevision;
    incomingRules = [];
    requestStatePage(0, STATE_PAGE_SIZE);
    return;
  }
  if (expectedRulesRevision !== null && message.rulesRevision !== expectedRulesRevision) {
    expectedRulesRevision = null;
    incomingRules = [];
    requestStatePage(0, 0);
    return;
  }
  expectedRulesRevision ??= message.rulesRevision;
  incomingRules.push(...(message.rules ?? []));
  const nextOffset = message.offset + message.rules.length;
  if (nextOffset < message.totalRules) {
    requestStatePage(nextOffset, STATE_PAGE_SIZE);
    return;
  }
  currentRules = incomingRules;
  stateRulesRevision = message.rulesRevision;
  try { await syncDynamicRules(); }
  finally { finishStateSync(); }
}

async function verifyDynamicRules() {
  try {
    const expected = toBrowserRules(currentRules);
    const installed = await browser.declarativeNetRequest.getDynamicRules();
    const byId = new Map(installed.map(rule => [rule.id, rule]));
    const matches = installed.length === expected.length && expected.every(rule => {
      const actual = byId.get(rule.id);
      return actual && actual.priority === rule.priority && actual.action.type === rule.action.type
        && stableJson(actual.condition) === stableJson(rule.condition);
    });
    if (matches) send('health', { browserFamily: getBrowserFamily(), ok: true });
    else await syncDynamicRules();
  } catch (error) {
    reportHealthFailure(error.message);
  }
}

function reportHealthFailure(error) {
  send('health', { browserFamily: getBrowserFamily(), ok: false, error });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function refreshState() {
  if (!nativePort && !connectNative()) return;
  if (fetchingState) {
    refreshAfterSync = true;
    return;
  }
  fetchingState = true;
  expectedRulesRevision = null;
  incomingRules = [];
  requestStatePage(0, 0);
}

function onNavigation(details) {
  if (details.frameId !== 0) return;
  const matched = findBrowserRule(details.url, currentRules);
  if (!matched) return;
  const key = `${details.tabId}:${details.url}`;
  if (seenAttempts.has(key)) return;
  seenAttempts.set(key, Date.now());
  for (const [oldKey, time] of seenAttempts) if (Date.now() - time > 15_000) seenAttempts.delete(oldKey);
  send('blocked', { url: details.url, ruleId: matched.id });
}

browser.webNavigation.onBeforeNavigate.addListener(onNavigation);
browser.webNavigation.onErrorOccurred.addListener(onNavigation);
browser.runtime.onInstalled.addListener(() => {
  browser.alarms.create('locky-refresh', { periodInMinutes: 0.5 });
  refreshState();
});
browser.runtime.onStartup.addListener(refreshState);
browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'locky-refresh') refreshState();
});

connectNative();
refreshState();
