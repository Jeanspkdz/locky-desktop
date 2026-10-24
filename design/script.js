const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const tabs = document.querySelectorAll('.tab');
const ruleList = document.querySelector('#rule-list');
const dialog = document.querySelector('#rule-dialog');
const form = document.querySelector('#rule-form');
const input = document.querySelector('#rule-value');
const error = document.querySelector('#field-error');
const help = document.querySelector('#scope-help');
const preview = document.querySelector('#lock-preview');
let filter = 'all';
let rules = [
  { id: 1, value: 'ejemplo.com/perfil', kind: 'path', state: 'pending', created: Date.now() - 2 * 60000, demo: true },
  { id: 2, value: 'sitio-ejemplo.com', kind: 'domain', state: 'consolidated', demo: true }
];

function showView(name) {
  views.forEach(view => view.classList.toggle('active', view.id === name));
  navItems.forEach(item => item.classList.toggle('active', item.dataset.view === name));
  window.scrollTo(0, 0);
}
navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
document.querySelectorAll('[data-go]').forEach(item => item.addEventListener('click', () => showView(item.dataset.go)));

function text(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
function remaining(rule) { return Math.max(0, 600 - Math.floor((Date.now() - rule.created) / 1000)); }
function renderRules() {
  rules.forEach(rule => { if (rule.state === 'pending' && remaining(rule) === 0) rule.state = 'consolidated'; });
  const shown = rules.filter(rule => filter === 'all' || rule.state === filter);
  ruleList.innerHTML = shown.map(rule => {
    const time = rule.state === 'pending' ? remaining(rule) : 0;
    const minutes = String(Math.floor(time / 60)).padStart(2, '0');
    const seconds = String(time % 60).padStart(2, '0');
    return `<div class="rule-row"><div class="rule-main"><strong>${text(rule.value)}</strong><small>${rule.demo ? 'Ejemplo de diseño' : 'Añadida en esta demostración'}</small></div><span class="rule-type">${rule.kind === 'domain' ? 'Dominio y subdominios' : 'Ruta y rutas inferiores'}</span><span class="badge ${rule.state === 'pending' ? 'badge-pending' : 'badge-solid'}">${rule.state === 'pending' ? `En verificación · ${minutes}:${seconds}` : 'Consolidada'}</span>${rule.state === 'pending' ? `<button class="cancel-rule" data-id="${rule.id}">Cancelar regla</button>` : '<span></span>'}</div>`;
  }).join('') || '<div class="inline-info">No hay reglas en esta vista.</div>';
  document.querySelector('#all-count').textContent = rules.length;
  document.querySelector('#pending-count').textContent = rules.filter(rule => rule.state === 'pending').length;
  document.querySelector('#consolidated-count').textContent = rules.filter(rule => rule.state === 'consolidated').length;
  document.querySelector('.nav-count').textContent = rules.length;
  ruleList.querySelectorAll('.cancel-rule').forEach(button => button.addEventListener('click', () => { rules = rules.filter(rule => rule.id !== Number(button.dataset.id)); renderRules(); }));
}
renderRules();
setInterval(renderRules, 1000);
tabs.forEach(tab => tab.addEventListener('click', () => { filter = tab.dataset.filter; tabs.forEach(t => t.classList.toggle('active', t === tab)); renderRules(); }));

document.querySelector('#add-rule').addEventListener('click', () => { form.reset(); input.value = ''; error.hidden = true; updateHelp(); dialog.showModal(); input.focus(); });
function updateHelp() { const path = form.elements.kind.value === 'path'; input.placeholder = path ? 'ejemplo.com/perfil' : 'ejemplo.com'; help.textContent = path ? 'Incluirá esta ruta y las rutas inferiores, sin bloquear el resto del sitio.' : 'Incluirá este dominio, sus subdominios y todas sus rutas.'; }
form.querySelectorAll('input[name="kind"]').forEach(radio => radio.addEventListener('change', updateHelp));
form.addEventListener('submit', event => {
  if (event.submitter?.value !== 'save') return;
  event.preventDefault();
  const value = input.value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const kind = form.elements.kind.value;
  const valid = /^[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+(?:\/[^\s?#]*)?$/i.test(value) && (kind === 'path' ? value.includes('/') : !value.includes('/'));
  if (!valid) { error.hidden = false; input.focus(); return; }
  rules.unshift({ id: Date.now(), value, kind, state: 'pending', created: Date.now() });
  filter = 'all'; tabs.forEach(t => t.classList.toggle('active', t.dataset.filter === 'all'));
  renderRules(); dialog.close(); showView('rules');
});

const browsers = ['Chrome', 'Brave', 'Edge', 'Firefox', 'Opera'];
document.querySelector('#browser-list').innerHTML = browsers.map(name => `<div class="browser-row"><span class="browser-logo">${name[0]}</span><span class="browser-name">${name}</span><span class="browser-status">Verificación pendiente</span></div>`).join('');
document.querySelector('#show-lock').addEventListener('click', () => { preview.hidden = false; document.querySelector('#exit-lock').focus(); });
document.querySelector('#exit-lock').addEventListener('click', () => { preview.hidden = true; document.querySelector('#show-lock').focus(); });
document.querySelector('#close-browsers').addEventListener('click', () => { preview.hidden = true; document.querySelector('#show-lock').focus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !preview.hidden) preview.hidden = true; });
