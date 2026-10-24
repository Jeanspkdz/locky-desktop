const ruleForm = document.querySelector('#rule-form');
const ruleType = document.querySelector('#rule-type');
const ruleValue = document.querySelector('#rule-value');
const formError = document.querySelector('#form-error');
const ruleList = document.querySelector('#rule-list');
const pendingList = document.querySelector('#pending-list');
const ruleCount = document.querySelector('#rule-count');
const candidateList = document.querySelector('#candidate-list');
const candidateCount = document.querySelector('#candidate-count');
const candidateTools = document.querySelector('#candidate-tools');
const candidateFooter = document.querySelector('#candidate-footer');
const candidateError = document.querySelector('#candidate-error');
const browserHealth = document.querySelector('#browser-health');
const BROWSER_NAMES = { chrome: 'Chrome', brave: 'Brave', edge: 'Edge', firefox: 'Firefox', opera: 'Opera' };
let candidateRows = [];
let candidatePage = 0;
let pendingRulesCache = [];
let stateClockNow = null;
let stateClockAtMono = 0;
const PAGE_SIZE = 50;

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

function renderBrowserHealth(health, enforcementEnabled) {
  browserHealth.replaceChildren();
  const entries = Object.entries(health ?? {});
  if (!entries.some(([, value]) => value.status !== 'idle')) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Todavía no se detectan navegadores abiertos.';
    browserHealth.append(empty);
    return;
  }
  for (const [family, value] of entries.filter(([, status]) => status.status !== 'idle')) {
    const row = document.createElement('div');
    row.className = `health-row ${value.status === 'repair' ? 'needs-repair' : ''}`;
    const name = document.createElement('strong');
    name.textContent = BROWSER_NAMES[family] ?? family;
    const status = document.createElement('span');
    status.textContent = value.status === 'healthy'
      ? 'Protegido'
      : value.status === 'checking'
        ? 'Comprobando integración…'
        : value.reason === 'missing'
          ? enforcementEnabled
            ? 'Reparación necesaria: instala o habilita la extensión Locky. El navegador fue cerrado.'
            : 'Reparación necesaria: instala o habilita la extensión Locky. En modo desarrollo el navegador no se cierra.'
          : value.reason === 'stale'
            ? enforcementEnabled
              ? 'Reparación necesaria: la extensión dejó de responder. El navegador fue cerrado.'
              : 'Reparación necesaria: la extensión dejó de responder. En modo desarrollo el navegador no se cierra.'
            : enforcementEnabled
              ? 'Reparación necesaria: Locky no pudo aplicar las reglas. Revisa la extensión y vuelve a abrir el navegador.'
              : 'Reparación necesaria: Locky no pudo aplicar las reglas. En modo desarrollo el navegador no se cierra.';
    row.append(name, status);
    browserHealth.append(row);
  }
}

async function refresh() {
  renderState(await window.locky.getState());
}

function renderState(state) {
  stateClockNow = state.clockNow;
  stateClockAtMono = performance.now();
  pendingRulesCache = state.pendingRules;
  ruleCount.textContent = String(state.rules.length);
  renderRows(ruleList, state.rules, false, state.clockNow);
  renderRows(pendingList, state.pendingRules, true, state.clockNow);
  renderBrowserHealth(state.browserHealth, state.enforcementEnabled);
  candidateRows = state.candidateList ?? [];
  renderCandidates();
}

function renderCandidates() {
  const search = document.querySelector('#candidate-search').value.trim().toLowerCase();
  const filtered = candidateRows.filter(candidate => candidate.domain.includes(search));
  const adultCount = candidateRows.filter(candidate => candidate.categories.includes('adult')).length;
  const gamblingCount = candidateRows.filter(candidate => candidate.categories.includes('gambling')).length;
  document.querySelector('#adult-count').textContent = `Adultos: ${adultCount.toLocaleString('es-PE')}`;
  document.querySelector('#gambling-count').textContent = `Apuestas: ${gamblingCount.toLocaleString('es-PE')}`;
  candidateCount.textContent = candidateRows.length
    ? `${candidateRows.length.toLocaleString('es-PE')} dominios nuevos para revisar`
    : 'No hay propuestas cargadas';
  candidateTools.hidden = candidateRows.length === 0;
  candidateFooter.hidden = filtered.length <= PAGE_SIZE;
  document.querySelector('#approve-candidates').disabled = candidateRows.length === 0;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  candidatePage = Math.min(candidatePage, pageCount - 1);
  document.querySelector('#candidate-page').textContent = `${candidatePage + 1} / ${pageCount}`;
  document.querySelector('#candidate-prev').disabled = candidatePage === 0;
  document.querySelector('#candidate-next').disabled = candidatePage >= pageCount - 1;
  candidateList.replaceChildren();
  const pageRows = filtered.slice(candidatePage * PAGE_SIZE, (candidatePage + 1) * PAGE_SIZE);
  if (!pageRows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Carga la propuesta para revisar sus dominios.';
    candidateList.append(empty);
    return;
  }
  for (const candidate of pageRows) {
    const row = document.createElement('div');
    row.className = 'candidate-row';
    const domain = document.createElement('span');
    domain.textContent = candidate.domain;
    const category = document.createElement('small');
    category.textContent = candidate.categories.map(value => value === 'adult' ? 'Adultos' : 'Apuestas').join(' · ');
    row.append(domain, category);
    candidateList.append(row);
  }
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

document.querySelector('#simulate').addEventListener('click', () => window.locky.simulateBlockedAttempt());
document.querySelector('#refresh-candidates').addEventListener('click', async event => {
  const button = event.currentTarget;
  candidateError.textContent = '';
  button.disabled = true;
  button.textContent = 'Cargando…';
  try {
    const result = await window.locky.refreshCandidates();
    candidateRows = result.candidates;
    candidatePage = 0;
    renderCandidates();
  } catch (error) {
    candidateError.textContent = `No se pudo cargar la propuesta: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = 'Cargar o actualizar propuesta';
  }
});
document.querySelector('#candidate-search').addEventListener('input', () => { candidatePage = 0; renderCandidates(); });
document.querySelector('#candidate-prev').addEventListener('click', () => { candidatePage -= 1; renderCandidates(); });
document.querySelector('#candidate-next').addEventListener('click', () => { candidatePage += 1; renderCandidates(); });
document.querySelector('#approve-candidates').addEventListener('click', async () => {
  candidateError.textContent = '';
  const confirmed = window.confirm(`Aprobar ${candidateRows.length.toLocaleString('es-PE')} dominios como reglas permanentes? Locky no permitirá retirarlos después.`);
  if (!confirmed) return;
  try {
    await window.locky.approveCandidates();
  } catch (error) {
    candidateError.textContent = error.message;
  }
});
window.locky.onStateChanged(renderState);
void refresh();
setInterval(() => {
  if (stateClockNow === null) return;
  const now = stateClockNow + performance.now() - stateClockAtMono;
  renderRows(pendingList, pendingRulesCache, true, now);
}, 1000);
