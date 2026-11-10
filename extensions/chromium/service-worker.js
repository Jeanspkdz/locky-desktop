if (typeof importScripts === 'function') importScripts('./rule-builder.js');
const { findBrowserRule, toBrowserRules } = globalThis.LockyRules;

const NATIVE_HOST = 'com.locky.desktop';
const FAIL_CLOSED_RULE_ID = 5001;
let nativePort;
let connectionGuardReady = Promise.resolve(false);
let currentRules = [];
let requestSequence = 0;
let stateRequestId = null;
let stateRulesRevision = null;
let expectedRulesRevision = null;
let incomingRules = [];
let fetchingState = false;
let stateRequestStartedAt = 0;
let refreshAfterSync = false;
let dnrQueue = Promise.resolve();
const seenAttempts = new Map();
const pendingNavigations = new Map();
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
    const connectedPort = nativePort;
    nativePort.onDisconnect.addListener(() => {
      if (nativePort !== connectedPort) return;
      nativePort = undefined;
      fetchingState = false;
      stateRequestStartedAt = 0;
      stateRequestId = null;
      connectionGuardReady = requireLockyConnection();
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
    connectionGuardReady = requireLockyConnection();
    return nativePort;
  } catch {
    nativePort = undefined;
    connectionGuardReady = requireLockyConnection();
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
  return enqueueDnrUpdate(async () => {
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
  }).then(() => true, () => false);
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
  stateRequestStartedAt = Date.now();
  nativePort.postMessage({ id: stateRequestId, type: 'getState', offset, limit });
}

function finishStateSync() {
  fetchingState = false;
  stateRequestStartedAt = 0;
  stateRequestId = null;
  if (refreshAfterSync) {
    refreshAfterSync = false;
    refreshState();
    return;
  }
  flushPendingNavigations();
}

async function handleStatePage(message) {
  if (message.limit === 0) {
    if (!(await connectionGuardReady)) {
      reportHealthFailure('Locky no pudo activar el bloqueo de emergencia.');
      return;
    }
    send('connected', { browserFamily: getBrowserFamily() });
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
    if (Date.now() - stateRequestStartedAt > 15_000) {
      const stalledPort = nativePort;
      nativePort = undefined;
      fetchingState = false;
      stateRequestId = null;
      stateRequestStartedAt = 0;
      connectionGuardReady = requireLockyConnection();
      stalledPort?.disconnect();
      if (!connectNative()) return;
    } else {
    refreshAfterSync = true;
    return;
    }
  }
  fetchingState = true;
  expectedRulesRevision = null;
  incomingRules = [];
  requestStatePage(0, 0);
}

function ensureRefreshAlarm() {
  try {
    Promise.resolve(chrome.alarms.create('locky-refresh', { periodInMinutes: 0.5 }))
      .catch(error => reportHealthFailure(error.message));
  } catch (error) {
    reportHealthFailure(error.message);
  }
}

function onNavigation(details) {
  if (details.frameId !== 0) return;
  if (stateRulesRevision === null) {
    const key = `${details.tabId}:${details.url}`;
    pendingNavigations.set(key, details);
    // Browser startup can emit several navigations before the first state page
    // arrives. Keep this bounded in case the native host stays unavailable.
    while (pendingNavigations.size > 200) {
      pendingNavigations.delete(pendingNavigations.keys().next().value);
    }
    if (!fetchingState) refreshState();
    return;
  }
  reportNavigation(details);
}

function flushPendingNavigations() {
  if (stateRulesRevision === null || fetchingState || pendingNavigations.size === 0) return;
  const pending = [...pendingNavigations.values()];
  pendingNavigations.clear();
  for (const details of pending) reportNavigation(details);
}

function reportNavigation(details) {
  const matched = findBrowserRule(details.url, currentRules);
  if (!matched) return;
  const key = `${details.tabId}:${details.url}`;
  if (seenAttempts.has(key)) return;
  seenAttempts.set(key, Date.now());
  for (const [oldKey, time] of seenAttempts) if (Date.now() - time > 15_000) seenAttempts.delete(oldKey);
  void (async () => {
    await replaceTabsWithBlankPage(details.tabId);
    send('blocked', { url: details.url, ruleId: matched.id });
  })();
}

async function replaceTabsWithBlankPage(blockedTabId) {
  if (!chrome.tabs?.query || !chrome.tabs?.create || !chrome.tabs?.remove) return;
  try {
    const tabs = await chrome.tabs.query({});
    if (tabs.length === 0) {
      await chrome.tabs.create({ url: 'about:blank', active: true });
      return;
    }

    const blockedTab = tabs.find(tab => tab.id === blockedTabId);
    const blankTab = await chrome.tabs.create({
      url: 'about:blank',
      active: true,
      ...(blockedTab?.windowId != null ? { windowId: blockedTab.windowId } : {}),
    });
    const tabsToClose = tabs.filter(tab => tab.id !== blankTab.id).map(tab => tab.id);
    if (tabsToClose.length > 0) {
      try {
        await chrome.tabs.remove(tabsToClose);
      } catch {
        if (blockedTab && chrome.tabs.update) await chrome.tabs.update(blockedTabId, { url: 'about:blank' });
      }
    }
  } catch {
    try {
      if (chrome.tabs.update) await chrome.tabs.update(blockedTabId, { url: 'about:blank' });
    } catch {
      // A tab may disappear while navigation is being cancelled. Still report the attempt.
    }
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(onNavigation);
chrome.webNavigation.onErrorOccurred.addListener(onNavigation);
chrome.runtime.onInstalled.addListener(() => {
  refreshState();
});
chrome.runtime.onStartup.addListener(refreshState);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'locky-refresh') refreshState();
});

ensureRefreshAlarm();
connectNative();
refreshState();
