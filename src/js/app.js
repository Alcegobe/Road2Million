/* app.js — contrôleur UI. Logique métier dans logic.js, persistance dans store.js. */

import { load, save, resetToDefault, importData, exportString, DEFAULT_DATA } from './store.js';
import * as L from './logic.js';
import { parseCsv } from './csv.js';

let state = load();
let selectedMonth = null;      // filtre mois (vue Dépenses)
let qaMode = 'expense';        // saisie rapide : 'expense' | 'income'
let qaCategory = null;         // catégorie sélectionnée pour la saisie rapide

/* ---------- Icônes Material (inline SVG, trait fin) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 4l9 6.5"/><path d="M5.5 9.5V20h13V9.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.2-3 7.3-7 8.5-4-1.2-7-4.3-7-8.5V6z"/>',
  settings: '<path d="M4 7h9M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3M11 17h9"/><circle cx="9" cy="17" r="2"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  arrowUp: '<path d="M12 19V6M6 12l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v13M6 12l6 6 6-6"/>',
  trendingUp: '<path d="M4 15l5-5 3 3 6-7"/><path d="M16 6h3v3"/>',
  insights: '<path d="M4 14l4-4 3 3 5-6"/><circle cx="16" cy="7" r="1.3" fill="currentColor" stroke="none"/>',
  bars: '<path d="M5 20V11M10 20V5M15 20v-6M20 20V9"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12h5"/>',
  upload: '<path d="M12 16V5M8 9l4-4 4 4"/><path d="M5 19h14"/>',
  download: '<path d="M12 5v11M8 12l4 4 4-4"/><path d="M5 19h14"/>',
  save: '<path d="M5 4h10l4 4v12H5z"/><path d="M8 4v5h6M8 20v-6h8v6"/>',
  handshake: '<ellipse cx="12" cy="6.5" rx="6" ry="2.5"/><path d="M6 6.5v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5"/><path d="M6 11.5v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5"/>',
  sprout: '<path d="M12 20v-7"/><path d="M12 13c-1-3-4-4-7-4 0 3 3 5 7 5z"/><path d="M12 13c1-3 4-4 7-4 0 3-3 5-7 5z"/>'
};
function svgIcon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}
function injectIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.dataset.iconDone) {
      el.innerHTML = svgIcon(el.dataset.icon);
      el.dataset.iconDone = '1';
    }
  });
}

/* ---------- utilitaires ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}
function escapeAttr(s) { return String(s ?? '').replace(/"/g, '&quot;'); }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}
function persist() { save(state); }

/* ============================================================
   ACCUEIL — saisie rapide + stats
============================================================ */
function renderQaChips() {
  const list = qaMode === 'expense' ? (state.categories || []).map((c) => c.name) : (state.income_categories || []);
  $('#qa-chips').innerHTML = list
    .map((name) => `<button type="button" class="chip ${name === qaCategory ? 'active' : ''}" data-chip="${escapeAttr(name)}">${escapeHtml(name)}</button>`)
    .join('');
  $$('#qa-chips .chip').forEach((el) =>
    el.addEventListener('click', () => {
      qaCategory = qaCategory === el.dataset.chip ? null : el.dataset.chip;
      renderQaChips();
    }));
}

function setMode(mode) {
  qaMode = mode;
  qaCategory = null;
  $$('#qa-seg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  renderQaChips();
  $('#qa-amount').focus();
}

function addQuickTransaction() {
  const raw = $('#qa-amount').value;
  const amt = parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(amt) || amt <= 0) { toast('Indique un montant'); $('#qa-amount').focus(); return; }
  const note = $('#qa-note').value.trim();
  const cat = qaCategory || (qaMode === 'expense' ? 'Autre' : 'Reçu');
  state.transactions.push({
    date: todayISO(),
    label: note || cat,
    amount: qaMode === 'expense' ? -Math.round(amt * 100) / 100 : Math.round(amt * 100) / 100,
    category: cat,
    note,
    source: 'manual'
  });
  persist();
  $('#qa-amount').value = '';
  $('#qa-note').value = '';
  renderHomeStats();
  toast(qaMode === 'expense' ? 'Dépense ajoutée ✓' : 'Reçu ajouté ✓');
  $('#qa-amount').focus();
}

function deltaChip(pct, label) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return `<span class="delta"><span class="lbl">${label}</span> n/a</span>`;
  }
  const rounded = Math.round(pct);
  const neutral = Math.abs(pct) < 0.5;
  const dir = neutral ? '' : pct > 0 ? 'up' : 'down';
  const arrow = pct > 0 ? 'arrowUp' : 'arrowDown';
  const sign = pct > 0 ? '+' : '';
  return `<span class="delta ${dir}">${neutral ? '' : `<span class="ico">${svgIcon(arrow)}</span>`}${sign}${rounded}% <span class="lbl">${label}</span></span>`;
}

function renderHome() {
  renderQaChips();
  renderHomeStats();
}

function renderHomeStats() {
  const today = new Date();
  const curMonth = L.ymKey(today);
  const tot = L.monthTotals(state, curMonth);

  $('#home-month').textContent = `${L.monthLabel(curMonth)} ${String(today.getFullYear()).slice(2)}`;
  $('#home-spent').textContent = L.eur(tot.spent);
  $('#home-received').textContent = L.eur(tot.received);
  const net = $('#home-net');
  net.textContent = `${tot.net >= 0 ? '+' : ''}${L.eur(tot.net)}`;
  net.className = `val ${tot.net < 0 ? 'neg' : 'pos'}`;

  const cmp = L.comparison(state, 'spent', today);
  $('#home-compare').innerHTML = deltaChip(cmp.pctPrev, 'vs mois dernier') + deltaChip(cmp.pctAvg3, 'vs moy. 3 mois');

  renderHomeChart(today);
  renderHomeTopCats(curMonth);
}

function renderHomeChart(today) {
  const series = L.monthlySeries(state, 6, today);
  const max = Math.max(1, ...series.map((s) => s.spent));
  $('#home-chart').innerHTML = series
    .map((s, i) => {
      const h = Math.round((s.spent / max) * 100);
      const cur = i === series.length - 1;
      return `<div class="bar-col" title="${L.monthLabel(s.month)} : ${L.eur(s.spent)}">
        <div class="bar-wrap"><div class="bar ${cur ? 'cur' : ''}" style="height:${Math.max(h, s.spent > 0 ? 4 : 1)}%"></div></div>
        <div class="bar-lbl">${L.monthLabel(s.month)}</div>
      </div>`;
    })
    .join('');
}

function renderHomeTopCats(curMonth) {
  const sp = L.spendingByCategory(state, curMonth);
  const box = $('#home-top-cats');
  if (!sp.count) {
    box.innerHTML = `<div class="empty">Rien encore ce mois. Ajoute une dépense ci-dessus, ou importe un CSV.</div>`;
    return;
  }
  const max = sp.items[0]?.total || 1;
  box.innerHTML = sp.items
    .slice(0, 5)
    .map((it) => `
      <div style="margin:12px 0">
        <div class="row" style="border:0;padding:0 0 4px">
          <span class="label">${escapeHtml(it.name)}</span>
          <span class="val">${L.eur(it.total)}</span>
        </div>
        <div class="progress" style="margin:0"><span style="width:${(it.total / max) * 100}%"></span></div>
      </div>`)
    .join('');
}

/* ============================================================
   DÉPENSES — import CSV + catégories
============================================================ */
function renderSpending() {
  const months = L.availableMonths(state);
  const sel = $('#month-select');
  if (selectedMonth === null) selectedMonth = months[0] || '';
  sel.innerHTML =
    `<option value="">Tout</option>` +
    months.map((m) => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${m}</option>`).join('');

  const spend = L.spendingByCategory(state, selectedMonth || null);
  const body = $('#spending-body');
  if (!spend.count) {
    body.innerHTML = `<div class="empty">Aucune transaction pour cette période.</div>`;
  } else {
    const max = spend.items[0]?.total || 1;
    body.innerHTML =
      `<div class="kpi" style="margin-bottom:12px"><span class="amount sm">${L.eur(spend.total)}</span><span class="unit">· ${spend.count} opérations</span></div>` +
      spend.items
        .map((it) => `
          <div style="margin:11px 0">
            <div class="row" style="border:0;padding:0 0 4px">
              <span class="label">${escapeHtml(it.name)}</span><span class="val">${L.eur(it.total)}</span>
            </div>
            <div class="progress" style="margin:0"><span style="width:${(it.total / max) * 100}%"></span></div>
          </div>`)
        .join('');
  }

  const recent = [...(state.transactions || [])]
    .filter((t) => !selectedMonth || (t.date || '').startsWith(selectedMonth))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 30);
  $('#recent-txns').innerHTML = recent.length
    ? recent
        .map((t) => `<div class="row">
            <span class="label">${t.date || '—'} · ${escapeHtml(t.label || '')}<br><small>${escapeHtml(t.category || 'Autre')}</small></span>
            <span class="val ${t.amount < 0 ? 'neg' : 'pos'}">${L.eurPrecise(t.amount)}</span>
          </div>`)
        .join('')
    : `<div class="empty">—</div>`;
}

function importCsvFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsv(String(reader.result));
    if (!parsed.rows.length) { $('#csv-feedback').textContent = parsed.warning || 'Aucune transaction détectée.'; return; }
    const categorized = L.categorizeAll(parsed.rows, state.categories).map((t) => ({ ...t, source: 'csv' }));
    const seen = new Set((state.transactions || []).map((t) => `${t.date}|${t.label}|${t.amount}`));
    let added = 0;
    for (const t of categorized) {
      const key = `${t.date}|${t.label}|${t.amount}`;
      if (!seen.has(key)) { state.transactions.push(t); seen.add(key); added++; }
    }
    persist();
    selectedMonth = null;
    renderSpending();
    $('#csv-feedback').textContent = `${added} transaction(s) importée(s)${added < categorized.length ? ` · ${categorized.length - added} doublon(s) ignoré(s)` : ''}.`;
    toast('Import CSV ✓');
  };
  reader.readAsText(file, 'utf-8');
}

function clearTransactions() {
  if (!confirm('Supprimer toutes les transactions ?')) return;
  state.transactions = [];
  persist();
  selectedMonth = null;
  renderSpending();
  toast('Transactions vidées');
}

/* ============================================================
   OBJECTIFS — matelas, ETF, prêt, alertes
============================================================ */
function renderGoals() {
  const cushion = L.cushionStatus(state);
  $('#cushion-current').textContent = L.eur(cushion.current);
  $('#cushion-target').textContent = `/ ${L.eur(cushion.target)}`;
  const bar = $('#cushion-bar');
  bar.firstElementChild.style.width = `${cushion.pct}%`;
  $('#cushion-hint').textContent = cushion.reached
    ? 'Matelas plein 🎉 — objectif n°1 atteint.'
    : `Encore ${L.eur(cushion.missing)} pour compléter (${Math.round(cushion.pct)} %).`;

  const etf = L.etfStatus(state);
  $('#etf-weekly').textContent = `${L.eur(etf.current)}/sem`;
  const labels = { reduce: 'À réduire', sustainable: 'Soutenable', ok: 'Aligné' };
  $('#etf-pill').innerHTML = `<span class="pill ${etf.level}">${labels[etf.level]}</span>`;
  $('#etf-message').textContent = etf.message;

  const rav = L.resteAVivre(state);
  const subs = L.subscriptionTotals(state);
  const rows = [
    ['Salaire estimé', L.eur(rav.salary), ''],
    ['Charges fixes', `– ${L.eur(rav.fixed)}`, 'neg'],
    ['ETF (mensualisé)', `– ${L.eur(rav.etfMonthly)}`, 'neg'],
    ['Reste à vivre théorique', L.eur(rav.value), rav.value < 0 ? 'neg' : 'pos']
  ];
  if (subs.total > 0) rows.splice(3, 0, ['dont abos (perso/pro)', `${L.eur(subs.perso)} / ${L.eur(subs.pro)}`, '']);
  $('#month-rows').innerHTML = rows
    .map(([label, val, cls]) => `<div class="row"><span class="label">${label}</span><span class="val ${cls}">${val}</span></div>`)
    .join('');

  const loan = L.loanStatus(state);
  const lb = $('#loan-body');
  if (!loan.configured) {
    lb.innerHTML = `<div class="hint">Renseigne mensualité + dates dans les Réglages pour suivre le restant dû.</div>`;
  } else {
    lb.innerHTML = `
      <div class="kpi"><span class="amount sm">${L.eur(loan.remaining)}</span><span class="unit">restant dû</span></div>
      <div class="progress"><span style="width:${loan.pct}%"></span></div>
      <div class="row"><span class="label">Remboursé</span><span class="val">${L.eur(loan.paid)} / ${L.eur(loan.total)}</span></div>
      <div class="row"><span class="label">Mois restants</span><span class="val">${loan.remainingMonths}</span></div>
      <div class="hint">0 % : l'argent le moins cher. On suit, on n'accélère pas.</div>`;
  }

  const gf = L.gamblingFreeDays(state);
  const gc = $('#gambling-card');
  if (gf.active) { gc.style.display = ''; $('#gf-days').textContent = gf.days; }
  else gc.style.display = 'none';

  renderAlerts();
}

function renderAlerts() {
  const out = [];
  const cushion = L.cushionStatus(state);
  const rt = L.roundTripAlert(state);
  if (rt.triggered) {
    out.push(`<div class="alert warn"><span class="ico">${svgIcon('arrowDown')}</span><div>
      <strong>Stop round-trip.</strong> Solde TR ${L.eur(rt.trCash)} sous le seuil de ${L.eur(rt.threshold)} avec un achat ETF prévu.
      Ne pas investir un argent qu'il faudra revendre.</div></div>`);
  }
  if (cushion.reached) {
    out.push(`<div class="alert good"><span class="ico">${svgIcon('check')}</span><div>
      <strong>Matelas atteint.</strong> Tu peux repasser l'ETF à un montant soutenable (${L.eur(state.settings.etf_sustainable_weekly_eur)}/sem).</div></div>`);
  } else if (L.etfStatus(state).level === 'reduce') {
    const etf = L.etfStatus(state);
    out.push(`<div class="alert info"><span class="ico">${svgIcon('shield')}</span><div>
      <strong>Priorité matelas.</strong> Réduis l'ETF à ${L.eur(etf.reduced)}/sem et envoie le surplus au cash.</div></div>`);
  }
  $('#alerts').innerHTML = out.join('');
}

/* ============================================================
   GARDE-FOUS
============================================================ */
function renderGuardrails() {
  const list = $('#guardrails-list');
  list.innerHTML = (state.guardrails || [])
    .map((g, i) => `
      <label class="check">
        <input type="checkbox" data-gr="${i}" ${g.done ? 'checked' : ''} />
        <span class="box">${svgIcon('check')}</span>
        <span class="txt">${escapeHtml(g.label)}</span>
      </label>`)
    .join('');
  $$('input[data-gr]', list).forEach((cb) =>
    cb.addEventListener('change', () => {
      state.guardrails[+cb.dataset.gr].done = cb.checked;
      persist();
      renderGuardrailsProgress();
    }));
  renderGuardrailsProgress();
}
function renderGuardrailsProgress() {
  const p = L.guardrailsProgress(state);
  $('#gr-count').textContent = `${p.done}/${p.total}`;
  $('#gr-bar').firstElementChild.style.width = `${p.pct}%`;
}

/* ============================================================
   RÉGLAGES + DONNÉES
============================================================ */
function renderSettings() {
  $$('input[data-path]').forEach((input) => {
    const val = getPath(state, input.dataset.path);
    if (input.type === 'checkbox') input.checked = !!val;
    else input.value = val ?? '';
  });
  renderChargesEditor();
  renderCategoriesEditor();
}

function renderChargesEditor() {
  const box = $('#charges-editor');
  box.innerHTML =
    (state.fixed_charges || [])
      .map((c, i) => `
        <div class="line-add" data-charge="${i}">
          <input type="text" value="${escapeAttr(c.label)}" data-charge-label="${i}" placeholder="Libellé" />
          <input type="number" value="${c.amount_eur ?? ''}" data-charge-amount="${i}" placeholder="€" style="max-width:110px" />
          <button class="remove-x" data-charge-del="${i}" title="Retirer">${svgIcon('add')}</button>
        </div>`)
      .join('') + `<div class="btn-row"><button id="add-charge" class="ghost" type="button">+ Ajouter une charge</button></div>`;
  // transforme l'icône "add" du bouton supprimer en croix (rotation via style)
  $$('button[data-charge-del] svg', box).forEach((svg) => (svg.style.transform = 'rotate(45deg)'));

  $$('input[data-charge-label]', box).forEach((el) =>
    el.addEventListener('input', () => (state.fixed_charges[+el.dataset.chargeLabel].label = el.value)));
  $$('input[data-charge-amount]', box).forEach((el) =>
    el.addEventListener('input', () => (state.fixed_charges[+el.dataset.chargeAmount].amount_eur = Number(el.value) || 0)));
  $$('button[data-charge-del]', box).forEach((el) =>
    el.addEventListener('click', () => { state.fixed_charges.splice(+el.dataset.chargeDel, 1); renderChargesEditor(); }));
  $('#add-charge', box).addEventListener('click', () => { state.fixed_charges.push({ label: '', amount_eur: 0 }); renderChargesEditor(); });
}

function renderCategoriesEditor() {
  const box = $('#categories-editor');
  if (!box) return;
  box.innerHTML =
    ((state.categories || [])
      .map((c, i) => `
        <div class="field" data-cat="${i}">
          <label>${escapeHtml(c.name)}</label>
          <input type="text" value="${escapeAttr((c.keywords || []).join(', '))}" data-cat-kw="${i}" placeholder="mot-clé1, mot-clé2…" />
        </div>`)
      .join('') || '<div class="hint">Aucune catégorie.</div>') +
    `<div class="btn-row"><button id="reset-cats" class="ghost" type="button">↺ Restaurer les catégories conseillées</button></div>
     <div class="hint">Une pompe à essence est rangée dans « Nourriture & crasses ». Ajoute tes enseignes (séparées par des virgules).</div>`;
  $$('input[data-cat-kw]', box).forEach((el) =>
    el.addEventListener('input', () => {
      state.categories[+el.dataset.catKw].keywords = el.value.split(',').map((s) => s.trim()).filter(Boolean);
    }));
  $('#reset-cats', box).addEventListener('click', () => {
    if (!confirm('Remplacer les règles par celles conseillées ? (tes montants et transactions ne sont pas touchés)')) return;
    state.categories = structuredClone(DEFAULT_DATA.categories);
    state.transactions = L.categorizeAll(state.transactions || [], state.categories);
    persist();
    renderCategoriesEditor();
    toast('Catégories restaurées ✓');
  });
}

function saveSettings() {
  $$('input[data-path]').forEach((input) => {
    let val;
    if (input.type === 'checkbox') val = input.checked;
    else if (input.type === 'number') val = input.value === '' ? 0 : Number(input.value);
    else val = input.value || (input.dataset.path === 'gambling_free_since' ? null : '');
    setPath(state, input.dataset.path, val);
  });
  persist();
  toast('Enregistré ✓');
  renderQaChips();
}

/* Données */
function exportData() {
  const blob = new Blob([exportString(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'data.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Export prêt ✓');
}
function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try { state = importData(JSON.parse(reader.result)); renderAll(); toast('Import réussi ✓'); }
    catch { toast('Fichier illisible ✗'); }
  };
  reader.readAsText(file);
}
function loadExample() {
  state = importData(DEMO);
  renderAll();
  toast('Exemple chargé ✓');
}
function resetAll() {
  if (!confirm('Effacer toutes les données locales et repartir de zéro ?')) return;
  state = resetToDefault();
  renderAll();
  toast('Réinitialisé');
}

/* Exemple de démo (valeurs bidon, hors-ligne). */
const DEMO = {
  settings: { cushion_target_eur: 1500, daily_cash_cap_eur: 20, low_balance_threshold_eur: 200, etf_reduced_weekly_eur: 50, etf_sustainable_weekly_eur: 100 },
  income: { salary_eur: 2300 },
  balances: { cushion_cash_eur: 600, tr_cash_eur: 150 },
  etf: { current_weekly_eur: 100, buy_planned: true },
  fixed_charges: [
    { label: 'Virement compte commun', amount_eur: 1200 },
    { label: 'Prêt papa (0%)', amount_eur: 250 },
    { label: 'Épargne enfant', amount_eur: 50 }
  ],
  loan_family: { label: 'Prêt papa (0%)', monthly_eur: 250, start: '2025-10-01', end: '2035-10-01', accelerate: false },
  gambling_free_since: null
};

/* ============================================================
   NAVIGATION + INIT
============================================================ */
const RENDERERS = { home: renderHome, spending: renderSpending, goals: renderGoals, guardrails: renderGuardrails, settings: renderSettings };

function switchView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('nav.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  (RENDERERS[name] || (() => {}))();
  window.scrollTo({ top: 0 });
}

function renderAll() {
  renderHome();
  renderSpending();
  renderGoals();
  renderGuardrails();
  renderSettings();
}

function bind() {
  $$('nav.tabbar button').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  $$('#qa-seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#qa-add').addEventListener('click', addQuickTransaction);
  $('#qa-amount').addEventListener('keydown', (e) => { if (e.key === 'Enter') addQuickTransaction(); });
  $('#qa-note').addEventListener('keydown', (e) => { if (e.key === 'Enter') addQuickTransaction(); });

  $('#save-settings').addEventListener('click', saveSettings);
  $('#export-btn').addEventListener('click', exportData);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => e.target.files[0] && handleImportFile(e.target.files[0]));
  $('#load-example').addEventListener('click', loadExample);
  $('#reset-btn').addEventListener('click', resetAll);
  $('#csv-btn').addEventListener('click', () => $('#csv-file').click());
  $('#csv-file').addEventListener('change', (e) => e.target.files[0] && importCsvFile(e.target.files[0]));
  $('#clear-txn').addEventListener('click', clearTransactions);
  $('#month-select').addEventListener('change', (e) => { selectedMonth = e.target.value; renderSpending(); });

  if (!window.matchMedia('(display-mode: standalone)').matches) {
    const h = $('#install-hint');
    if (h) h.style.display = '';
  }
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
}

injectIcons();
bind();
renderAll();
registerSW();
