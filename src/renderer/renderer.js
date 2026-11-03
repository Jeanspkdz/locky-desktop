const ruleForm = document.querySelector('#rule-form');
const ruleType = document.querySelector('#rule-type');
const ruleValue = document.querySelector('#rule-value');
const formError = document.querySelector('#form-error');
const pendingList = document.querySelector('#pending-list');
const browserHealth = document.querySelector('#browser-health');
const BROWSER_NAMES = { chrome: 'Chrome', edge: 'Edge', brave: 'Brave' };
let pendingRulesCache = [];
let stateClockNow = null;
let stateClockAtMono = 0;

function formatRule(rule) {
  return rule.type === 'domain' ? rule.host : `${rule.host}${rule.path}`;
}

function renderRows(target, rules, pending = false, clockNow = null) {
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
    title.textContent = formatRule(rule);
    const type = document.createElement('span');
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
  renderRows(pendingList, state.pendingRules, true, state.clockNow);
  renderBrowserHealth(state.browserHealth, state.enforcementEnabled, ruleCount > 0);
}

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
  renderRows(pendingList, pendingRulesCache, true, now);
}, 1000);
