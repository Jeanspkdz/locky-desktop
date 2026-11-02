if (typeof importScripts === 'function') importScripts('./rule-builder.js');
const { findBrowserRule, toBrowserRules } = globalThis.LockyRules;

const NATIVE_HOST = 'com.locky.desktop';
const FAIL_CLOSED_RULE_ID = 5001;
let nativePort;
let currentRules = [];
let requestSequence = 0;
let stateRequestId = null;
let stateRulesRevision = null;
let expectedRulesRevision = null;
let incomingRules = [];
let fetchingState = false;
let refreshAfterSync = false;
let dnrQueue = Promise.resolve();
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
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    nativePort.onDisconnect.addListener(() => {
      nativePort = undefined;
      fetchingState = false;
      stateRequestId = null;
      requireLockyConnection();
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
    requireLockyConnection();
    return nativePort;
  } catch {
    nativePort = undefined;
    requireLockyConnection();
    setTimeout(() => { connectNative(); refreshState(); }, 3000);
    return undefined;
  }
}

function enqueueDnrUpdate(update) {
  const result = dnrQueue.then(update, update);
  dnrQueue = result.catch(() => {});
  return result;
}

function failClosedRule() {
  return {
    id: FAIL_CLOSED_RULE_ID,
    priority: 1000,
    action: { type: 'block' },
    condition: { urlFilter: '|http', resourceTypes: ['main_frame'] },
  };
}

function requireLockyConnection() {
  void enqueueDnrUpdate(async () => {
    const rule = failClosedRule();
    if (typeof chrome.declarativeNetRequest.updateSessionRules === 'function') {
      const existing = await chrome.declarativeNetRequest.getSessionRules();
      if (!existing.some(item => item.id === rule.id)) {
        await chrome.declarativeNetRequest.updateSessionRules({ addRules: [rule] });
      }
      return;
    }
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    if (!existing.some(item => item.id === rule.id)) {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
    }
  }).catch(() => {});
}

function clearLockyConnectionGuard() {
  return enqueueDnrUpdate(async () => {
    if (typeof chrome.declarativeNetRequest.updateSessionRules === 'function') {
      const existing = await chrome.declarativeNetRequest.getSessionRules();
      if (existing.some(item => item.id === FAIL_CLOSED_RULE_ID)) {
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [FAIL_CLOSED_RULE_ID] });
      }
      return;
    }
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    if (existing.some(item => item.id === FAIL_CLOSED_RULE_ID)) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [FAIL_CLOSED_RULE_ID] });
    }
  });
}

function send(type, detail = {}) {
  const port = connectNative();
  if (!port) return;
  port.postMessage({ id: ++requestSequence, type, ...detail });
}

async function syncDynamicRules() {
  await enqueueDnrUpdate(async () => {
    const browserRules = toBrowserRules(currentRules);
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map(rule => rule.id),
      addRules: browserRules,
    });
  });
  await clearLockyConnectionGuard();
  send('health', { browserFamily: getBrowserFamily(), ok: true });
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
  catch (error) { reportHealthFailure(error.message); }
  finally { finishStateSync(); }
}

async function verifyDynamicRules() {
  try {
    const expected = toBrowserRules(currentRules);
    const installed = await chrome.declarativeNetRequest.getDynamicRules();
    const byId = new Map(installed.map(rule => [rule.id, rule]));
    const matches = installed.length === expected.length && expected.every(rule => {
      const actual = byId.get(rule.id);
      return actual && actual.priority === rule.priority && actual.action.type === rule.action.type
        && stableJson(actual.condition) === stableJson(rule.condition);
    });
    if (matches) {
      await clearLockyConnectionGuard();
      send('health', { browserFamily: getBrowserFamily(), ok: true });
    }
    else await syncDynamicRules();
  } catch (error) {
    reportHealthFailure(error.message);
  }
}

function reportHealthFailure(error) {
  requireLockyConnection();
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

chrome.webNavigation.onBeforeNavigate.addListener(onNavigation);
chrome.webNavigation.onErrorOccurred.addListener(onNavigation);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('locky-refresh', { periodInMinutes: 0.5 });
  refreshState();
});
chrome.runtime.onStartup.addListener(refreshState);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'locky-refresh') refreshState();
});

connectNative();
refreshState();
