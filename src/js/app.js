/* app.js — contrôleur de l'UI : rendu + événements. Aucune logique métier ici
   (elle est dans logic.js), aucune persistance directe (elle est dans store.js). */

import { load, save, resetToDefault, importData, exportString } from './store.js';
import * as L from './logic.js';

let state = load();

/* Exemple de démo intégré (valeurs bidon) — utilisable hors-ligne, sans fichier. */
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

/* ---------- petits utilitaires ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function persist() {
  save(state);
}

/* ============================================================
   RENDU — TABLEAU DE BORD
============================================================ */
function renderDashboard() {
  const cushion = L.cushionStatus(state);
  $('#cushion-current').textContent = L.eur(cushion.current);
  $('#cushion-target').textContent = `/ ${L.eur(cushion.target)}`;
  const bar = $('#cushion-bar');
  bar.firstElementChild.style.width = `${cushion.pct}%`;
  bar.classList.toggle('good', cushion.reached);
  $('#cushion-hint').textContent = cushion.reached
    ? 'Matelas plein 🎉 — objectif n°1 atteint.'
    : `Encore ${L.eur(cushion.missing)} pour compléter le matelas (${Math.round(cushion.pct)} %).`;

  // ETF
  const etf = L.etfStatus(state);
  $('#etf-weekly').textContent = `${L.eur(etf.current)}/sem`;
  const labels = { reduce: 'À réduire', sustainable: 'Soutenable', ok: 'Aligné' };
  $('#etf-pill').innerHTML = `<span class="pill ${etf.level}">${labels[etf.level]}</span>`;
  $('#etf-message').textContent = etf.message;

  // Le mois
  const rav = L.resteAVivre(state);
  const subs = L.subscriptionTotals(state);
  const rows = [
    ['Salaire estimé', L.eur(rav.salary), ''],
    ['Charges fixes', `– ${L.eur(rav.fixed)}`, 'neg'],
    ['ETF (mensualisé)', `– ${L.eur(rav.etfMonthly)}`, 'neg'],
    ['Reste à vivre estimé', L.eur(rav.value), rav.value < 0 ? 'neg' : 'pos']
  ];
  if (subs.total > 0) rows.splice(3, 0, ['dont abos (perso/pro)', `${L.eur(subs.perso)} / ${L.eur(subs.pro)}`, '']);
  $('#month-rows').innerHTML = rows
    .map(([label, val, cls]) => `<div class="row"><span class="label">${label}</span><span class="val ${cls}">${val}</span></div>`)
    .join('');

  // Prêt papa
  const loan = L.loanStatus(state);
  const lb = $('#loan-body');
  if (!loan.configured) {
    lb.innerHTML = `<div class="hint">Renseigne mensualité + dates dans les Réglages pour suivre le restant dû.</div>`;
  } else {
    lb.innerHTML = `
      <div class="kpi"><span class="big">${L.eur(loan.remaining)}</span><span class="target">restant dû</span></div>
      <div class="progress good" style="margin-top:10px"><span style="width:${loan.pct}%"></span></div>
      <div class="row" style="margin-top:8px"><span class="label">Remboursé</span><span class="val">${L.eur(loan.paid)} / ${L.eur(loan.total)}</span></div>
      <div class="row"><span class="label">Mois restants</span><span class="val">${loan.remainingMonths}</span></div>
      <div class="hint">0 % : c'est l'argent le moins cher. On suit, on n'accélère pas.</div>`;
  }

  // Compteur jours sans jeu
  const gf = L.gamblingFreeDays(state);
  const gc = $('#gambling-card');
  if (gf.active) {
    gc.style.display = '';
    $('#gf-days').textContent = gf.days;
  } else {
    gc.style.display = 'none';
  }

  renderAlerts();
}

function renderAlerts() {
  const box = $('#alerts');
  const out = [];
  const cushion = L.cushionStatus(state);
  const rt = L.roundTripAlert(state);

  if (rt.triggered) {
    out.push(`<div class="alert warn"><span class="ico">⚠️</span><div>
      <strong>Stop round-trip.</strong> Solde TR ${L.eur(rt.trCash)} sous le seuil de ${L.eur(rt.threshold)}, et un achat ETF est prévu.
      <br>Ne pas investir un argent qu'il faudra revendre.</div></div>`);
  }
  if (cushion.reached) {
    out.push(`<div class="alert good"><span class="ico">🎉</span><div>
      <strong>Matelas atteint.</strong> Tu peux repasser l'ETF à un montant soutenable (${L.eur(state.settings.etf_sustainable_weekly_eur)}/sem) — un montant qu'on ne reprendra pas.</div></div>`);
  } else {
    const etf = L.etfStatus(state);
    if (etf.level === 'reduce') {
      out.push(`<div class="alert info"><span class="ico">🛟</span><div>
        <strong>Priorité matelas.</strong> Réduis l'ETF à ${L.eur(etf.reduced)}/sem et envoie le surplus au cash jusqu'à ${L.eur(cushion.target)}.</div></div>`);
    }
  }
  box.innerHTML = out.join('');
}

/* ============================================================
   RENDU — GARDE-FOUS
============================================================ */
function renderGuardrails() {
  const list = $('#guardrails-list');
  list.innerHTML = (state.guardrails || [])
    .map((g, i) => `
      <label class="check">
        <input type="checkbox" data-gr="${i}" ${g.done ? 'checked' : ''} />
        <span class="box">✓</span>
        <span class="txt">${g.label}</span>
      </label>`)
    .join('');

  $$('input[data-gr]', list).forEach((cb) =>
    cb.addEventListener('change', () => {
      state.guardrails[+cb.dataset.gr].done = cb.checked;
      persist();
      renderGuardrailsProgress();
    })
  );
  renderGuardrailsProgress();
}

function renderGuardrailsProgress() {
  const p = L.guardrailsProgress(state);
  $('#gr-count').textContent = `${p.done}/${p.total}`;
  $('#gr-bar').firstElementChild.style.width = `${p.pct}%`;
}

/* ============================================================
   RENDU — RÉGLAGES
============================================================ */
function renderSettings() {
  $$('input[data-path]').forEach((input) => {
    const val = getPath(state, input.dataset.path);
    if (input.type === 'checkbox') input.checked = !!val;
    else input.value = val ?? '';
  });
  renderChargesEditor();
}

function renderChargesEditor() {
  const box = $('#charges-editor');
  const rows = (state.fixed_charges || [])
    .map((c, i) => `
      <div class="line-add" data-charge="${i}">
        <input type="text" value="${escapeAttr(c.label)}" data-charge-label="${i}" placeholder="Libellé" />
        <input type="number" value="${c.amount_eur ?? ''}" data-charge-amount="${i}" placeholder="€" style="max-width:110px" />
        <button class="remove-x" data-charge-del="${i}" title="Retirer">✕</button>
      </div>`)
    .join('');
  box.innerHTML = rows + `<div class="btn-row"><button id="add-charge" class="ghost">+ Ajouter une charge</button></div>`;

  $$('input[data-charge-label]', box).forEach((el) =>
    el.addEventListener('input', () => (state.fixed_charges[+el.dataset.chargeLabel].label = el.value)));
  $$('input[data-charge-amount]', box).forEach((el) =>
    el.addEventListener('input', () => (state.fixed_charges[+el.dataset.chargeAmount].amount_eur = Number(el.value) || 0)));
  $$('button[data-charge-del]', box).forEach((el) =>
    el.addEventListener('click', () => {
      state.fixed_charges.splice(+el.dataset.chargeDel, 1);
      renderChargesEditor();
    }));
  $('#add-charge', box).addEventListener('click', () => {
    state.fixed_charges.push({ label: '', amount_eur: 0 });
    renderChargesEditor();
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
  renderDashboard();
}

/* ============================================================
   DONNÉES — export / import / reset
============================================================ */
function exportData() {
  const blob = new Blob([exportString(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Export prêt ✓');
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = importData(JSON.parse(reader.result));
      renderAll();
      toast('Import réussi ✓');
    } catch (e) {
      toast('Fichier illisible ✗');
    }
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

/* ============================================================
   NAVIGATION + INIT
============================================================ */
function switchView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('nav.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'settings') renderSettings();
  if (name === 'guardrails') renderGuardrails();
  if (name === 'dashboard') renderDashboard();
  window.scrollTo({ top: 0 });
}

function renderAll() {
  renderDashboard();
  renderGuardrails();
  renderSettings();
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

function bind() {
  $$('nav.tabbar button').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('#save-settings').addEventListener('click', saveSettings);
  $('#export-btn').addEventListener('click', exportData);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => e.target.files[0] && handleImportFile(e.target.files[0]));
  $('#load-example').addEventListener('click', loadExample);
  $('#reset-btn').addEventListener('click', resetAll);

  if (!window.matchMedia('(display-mode: standalone)').matches) {
    const h = $('#install-hint');
    if (h) h.style.display = '';
  }
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
}

bind();
renderAll();
registerSW();
