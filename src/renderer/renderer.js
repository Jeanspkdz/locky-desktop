const ruleForm = document.querySelector('#rule-form');
const ruleType = document.querySelector('#rule-type');
const ruleValue = document.querySelector('#rule-value');
const formError = document.querySelector('#form-error');
const pendingList = document.querySelector('#pending-list');
const browserHealth = document.querySelector('#browser-health');
const dnsStatus = document.querySelector('#dns-status');
const dnsBadge = document.querySelector('#dns-badge');
const pendingToggle = document.querySelector('#toggle-pending-rules');
const pendingSummary = document.querySelector('#pending-summary');
const BROWSER_NAMES = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave' };
const RECENT_RULE_LIMIT = 3;
const SCRAMBLE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let pendingRulesCache = [];
let newPendingRuleIds = new Set();
let seenPendingRuleIds = new Set();
let pendingRulesLoaded = false;
let showAllPendingRules = false;
let stateClockNow = null;
let stateClockAtMono = 0;

function formatRule(rule) {
  return rule.type === 'domain' ? rule.host : `${rule.host}${rule.path}`;
}

function scrambleText(target, text) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !text) {
    target.textContent = text;
    return;
  }
  const startedAt = performance.now();
  const duration = 650;
  function frame(now) {
    const elapsed = Math.min(duration, now - startedAt);
    target.textContent = [...text].map((character, index) => {
      if (/\s/.test(character) || elapsed >= (index / text.length) * duration) return character;
      return SCRAMBLE_CHARACTERS[Math.floor(Math.random() * SCRAMBLE_CHARACTERS.length)];
    }).join('');
    if (elapsed < duration) requestAnimationFrame(frame);
    else target.textContent = text;
  }
  requestAnimationFrame(frame);
}

function renderRows(target, rules, pending = false, clockNow = null, animatedRuleIds = new Set()) {
  target.replaceChildren();
  if (!rules.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = pending ? 'No hay reglas pendientes.' : 'Todavía no hay reglas consolidadas.';
    target.append(empty);
    return;
  }
  for (const rule of rules) {
    const row = document.createElement('article');
    row.className = 'rule-row';
    const info = document.createElement('div');
    const title = document.createElement('strong');
    const label = formatRule(rule);
    title.setAttribute('aria-label', label);
    const visibleLabel = document.createElement('span');
    visibleLabel.className = 'rule-name';
    visibleLabel.setAttribute('aria-hidden', 'true');
    visibleLabel.textContent = label;
    title.append(visibleLabel);
    if (animatedRuleIds.has(rule.id)) scrambleText(visibleLabel, label);
    const type = document.createElement('span');
    type.className = 'rule-kind';
    type.textContent = rule.type === 'domain' ? 'Dominio completo' : 'URL específica';
    info.append(title, type);
    row.append(info);
    if (pending) {
      const remaining = document.createElement('span');
      remaining.className = 'pending-time';
      remaining.textContent = clockNow === null
        ? 'Hora pendiente'
        : `${Math.max(0, Math.ceil((rule.consolidatesAt - clockNow) / 1000))} s`;
      const cancel = document.createElement('button');
      cancel.className = 'text-button';
      cancel.textContent = 'Cancelar';
      cancel.addEventListener('click', async () => {
        await window.locky.cancelRule(rule.id);
      });
      row.append(remaining, cancel);
    } else {
      const permanent = document.createElement('span');
      permanent.className = 'permanent-label';
      permanent.textContent = 'Permanente';
      row.append(permanent);
    }
    target.append(row);
  }
}

function renderBrowserHealth(health, enforcementEnabled, hasRules) {
  browserHealth.replaceChildren();
  for (const family of ['chrome', 'edge', 'brave']) {
    const value = health?.[family] ?? { status: 'idle' };
    const row = document.createElement('article');
    row.className = `health-row health-${value.status}`;
    const icon = document.createElement('span');
    icon.className = 'browser-icon';
    icon.textContent = family[0].toUpperCase();
    icon.setAttribute('aria-hidden', 'true');
    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = BROWSER_NAMES[family];
    const status = document.createElement('span');
    status.textContent = value.status === 'healthy'
      ? 'Integración conectada'
      : value.status === 'checking'
        ? 'Comprobando integración…'
        : value.status === 'idle'
          ? 'Se comprobará al abrirlo'
        : !hasRules
          ? value.reason === 'stale'
            ? 'La extensión dejó de responder. Revísala antes de activar reglas.'
            : 'Extensión no detectada. Instálala antes de activar reglas.'
        : value.reason === 'overlay'
          ? 'Reparación necesaria: Locky no pudo cubrir la ventana del navegador. Repara la instalación y, si el navegador está abierto como administrador, ejecútalo con el mismo nivel de permisos que Locky.'
        : value.reason === 'watcher'
          ? enforcementEnabled
            ? 'Reparación necesaria: Locky no puede vigilar los navegadores. Se cerraron para mantener la protección.'
            : 'Reparación necesaria: Locky no puede vigilar los navegadores. Reinicia Locky después de reparar la integración.'
        : value.reason === 'missing'
          ? enforcementEnabled
            ? 'Reparación necesaria: Locky no recibió respuesta de la extensión. El navegador fue cerrado.'
            : 'Reparación necesaria: Locky no recibió respuesta de la extensión. En modo desarrollo el navegador no se cierra.'
          : value.reason === 'stale'
            ? enforcementEnabled
              ? 'Reparación necesaria: la extensión dejó de responder. El navegador fue cerrado.'
              : 'Reparación necesaria: la extensión dejó de responder. En modo desarrollo el navegador no se cierra.'
            : enforcementEnabled
              ? 'Reparación necesaria: Locky no pudo aplicar las reglas. Revisa la extensión y vuelve a abrir el navegador.'
              : 'Reparación necesaria: Locky no pudo aplicar las reglas. En modo desarrollo el navegador no se cierra.';
    info.append(name, status);
    row.append(icon, info);
    browserHealth.append(row);
  }
}

async function refresh() {
  renderState(await window.locky.getState());
  await refreshDnsProtection();
}

async function refreshDnsProtection() {
  try {
    const status = await window.locky.getDnsProtectionStatus();
    dnsBadge.classList.toggle('dns-active', status.running);
    dnsBadge.classList.toggle('dns-missing', !status.running);
    dnsBadge.textContent = status.running ? 'Servicio activo' : 'No está activo';
    dnsStatus.textContent = !status.supported
      ? 'La protección DNS del sistema solo está disponible en Windows.'
      : status.running
        ? 'El servicio de sistema está en ejecución. Locky vuelve a comprobar DNS, firewall y políticas periódicamente.'
        : 'El servicio de sistema no está en ejecución. Pide a la persona administradora que repare la instalación.';
  } catch {
    dnsBadge.classList.remove('dns-active');
    dnsBadge.classList.add('dns-missing');
    dnsBadge.textContent = 'Estado desconocido';
    dnsStatus.textContent = 'No se pudo consultar el estado del servicio.';
  }
}

function renderState(state) {
  const browserStates = ['chrome', 'edge', 'brave'].map(family => state.browserHealth?.[family]?.status ?? 'idle');
  const ruleCount = state.ruleCount ?? 0;
  const status = document.querySelector('#status');
  status.textContent = !ruleCount ? 'Sin reglas bloqueantes'
    : browserStates.includes('repair') ? 'Reparación necesaria'
      : browserStates.includes('checking') ? 'Comprobando integración…'
        : 'Protección activa';
  status.classList.toggle('needs-attention', browserStates.includes('repair'));
  stateClockNow = state.clockNow;
  stateClockAtMono = performance.now();
  pendingRulesCache = state.pendingRules;
  newPendingRuleIds = new Set();
  for (const rule of state.pendingRules) {
    if (pendingRulesLoaded && !seenPendingRuleIds.has(rule.id)) newPendingRuleIds.add(rule.id);
    seenPendingRuleIds.add(rule.id);
  }
  pendingRulesLoaded = true;
  renderPendingRules(state.clockNow);
  renderBrowserHealth(state.browserHealth, state.enforcementEnabled, ruleCount > 0);
}

function renderPendingRules(clockNow = null) {
  const newestFirst = [...pendingRulesCache].sort((left, right) => right.createdAt - left.createdAt);
  const hasHiddenRules = newestFirst.length > RECENT_RULE_LIMIT;
  const visibleRules = showAllPendingRules || !hasHiddenRules
    ? newestFirst
    : newestFirst.slice(0, RECENT_RULE_LIMIT);
  pendingToggle.hidden = !hasHiddenRules;
  pendingToggle.setAttribute('aria-expanded', String(showAllPendingRules));
  pendingToggle.textContent = showAllPendingRules
    ? `Mostrar solo las ${RECENT_RULE_LIMIT} más recientes`
    : `Mostrar todas (${newestFirst.length})`;
  pendingSummary.hidden = !hasHiddenRules;
  pendingSummary.textContent = showAllPendingRules
    ? `Mostrando todas las ${newestFirst.length} reglas pendientes.`
    : `Mostrando las ${RECENT_RULE_LIMIT} más recientes de ${newestFirst.length} reglas pendientes.`;
  renderRows(pendingList, visibleRules, true, clockNow, newPendingRuleIds);
  newPendingRuleIds.clear();
}

pendingToggle.addEventListener('click', () => {
  showAllPendingRules = !showAllPendingRules;
  const now = stateClockNow === null ? null : stateClockNow + performance.now() - stateClockAtMono;
  renderPendingRules(now);
});

ruleForm.addEventListener('submit', async event => {
  event.preventDefault();
  formError.textContent = '';
  try {
    await window.locky.addRule({ type: ruleType.value, value: ruleValue.value });
    ruleValue.value = '';
  } catch (error) {
    formError.textContent = error.message;
  }
});

const simulateButton = document.querySelector('#simulate');
void window.locky.isPackaged().then(isPackaged => {
  simulateButton.closest('.dev-tools').hidden = isPackaged;
});
simulateButton.addEventListener('click', async event => {
  const button = event.currentTarget;
  formError.textContent = '';
  button.disabled = true;
  try {
    await window.locky.simulateBlockedAttempt();
  } catch (error) {
    formError.textContent = `No se pudo simular el bloqueo: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
window.locky.onStateChanged(renderState);
void refresh();
setInterval(() => {
  if (stateClockNow === null) return;
  const now = stateClockNow + performance.now() - stateClockAtMono;
  renderPendingRules(now);
}, 1000);
setInterval(() => void refreshDnsProtection(), 15000);
