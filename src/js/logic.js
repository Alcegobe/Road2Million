/* logic.js — toute la logique métier du cahier des charges (§3).
   Fonctions pures : (data) -> résultats calculés. Faciles à tester, sans effet de bord. */

export const WEEKS_PER_MONTH = 52 / 12; // ≈ 4.3452

export const eur = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  });

export const eurPrecise = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2
  });

export const weeklyToMonthly = (weekly) => (Number(weekly) || 0) * WEEKS_PER_MONTH;

export function fixedChargesTotal(data) {
  return (data.fixed_charges || []).reduce((s, c) => s + (Number(c.amount_eur) || 0), 0);
}

/* Matelas de sécurité : cash / cible. Priorité n°1. */
export function cushionStatus(data) {
  const current = Number(data.balances?.cushion_cash_eur) || 0;
  const target = Number(data.settings?.cushion_target_eur) || 0;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const reached = target > 0 && current >= target;
  const missing = Math.max(0, target - current);
  return { current, target, pct, reached, missing };
}

/* ETF : « soutenable » seulement si le matelas est plein. Sinon « à réduire ». */
export function etfStatus(data) {
  const reached = cushionStatus(data).reached;
  const current = Number(data.etf?.current_weekly_eur) || 0;
  const reduced = Number(data.settings?.etf_reduced_weekly_eur) || 0;
  const sustainable = Number(data.settings?.etf_sustainable_weekly_eur) || 0;
  const recommended = reached ? sustainable : reduced;

  let level, message;
  if (!reached && current > reduced) {
    level = 'reduce';
    message = `À réduire : tant que le matelas n'est pas plein, vise ${eur(reduced)}/sem (le surplus va au cash).`;
  } else if (reached) {
    level = 'sustainable';
    message = `Matelas plein : tu peux tenir un ETF soutenable (${eur(sustainable)}/sem) — un montant qu'on ne reprendra pas.`;
  } else {
    level = 'ok';
    message = `Rythme aligné sur l'objectif matelas (${eur(reduced)}/sem). Le surplus part au cash.`;
  }
  return { current, reduced, sustainable, recommended, reached, level, message };
}

/* Reste à vivre estimé = salaire - charges fixes - ETF mensualisé. */
export function resteAVivre(data) {
  const salary = Number(data.income?.salary_eur) || 0;
  const fixed = fixedChargesTotal(data);
  const etfMonthly = weeklyToMonthly(data.etf?.current_weekly_eur);
  return { salary, fixed, etfMonthly, value: salary - fixed - etfMonthly };
}

/* Alerte round-trip : solde TR bas + achat ETF prévu. */
export function roundTripAlert(data) {
  const trCash = Number(data.balances?.tr_cash_eur) || 0;
  const threshold = Number(data.settings?.low_balance_threshold_eur) || 0;
  const buyPlanned = !!data.etf?.buy_planned;
  const triggered = buyPlanned && trCash < threshold;
  return { trCash, threshold, buyPlanned, triggered };
}

/* Prêt papa (0 %) : on n'accélère pas, on suit juste le restant dû. */
export function loanStatus(data, today = new Date()) {
  const loan = data.loan_family || {};
  const monthly = Number(loan.monthly_eur) || 0;
  const start = loan.start ? new Date(loan.start) : null;
  const end = loan.end ? new Date(loan.end) : null;
  if (!monthly || !start || !end || isNaN(start) || isNaN(end)) {
    return { configured: false };
  }
  const totalMonths = monthsBetween(start, end);
  const elapsed = Math.max(0, Math.min(totalMonths, monthsBetween(start, today)));
  const paidMonths = elapsed;
  const remainingMonths = Math.max(0, totalMonths - paidMonths);
  const total = monthly * totalMonths;
  const remaining = monthly * remainingMonths;
  const paid = total - remaining;
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return { configured: true, monthly, totalMonths, remainingMonths, total, remaining, paid, pct };
}

function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/* Compteur « jours sans jeu » — encouragement, jamais un contrôle. */
export function gamblingFreeDays(data, today = new Date()) {
  const since = data.gambling_free_since;
  if (!since) return { active: false };
  const start = new Date(since);
  if (isNaN(start)) return { active: false };
  const days = Math.max(0, Math.floor((stripTime(today) - stripTime(start)) / 86400000));
  return { active: true, days, since };
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/* Abonnements : totaux pro / perso. */
export function subscriptionTotals(data) {
  const subs = data.subscriptions || [];
  const perso = subs.filter((s) => s.scope === 'perso').reduce((s, x) => s + (Number(x.amount_eur) || 0), 0);
  const pro = subs.filter((s) => s.scope === 'pro').reduce((s, x) => s + (Number(x.amount_eur) || 0), 0);
  return { perso, pro, total: perso + pro };
}

/* Catégorise un libellé d'après les règles (mots-clés). Renvoie le nom ou 'Autre'. */
export function categorize(label, categories) {
  const l = String(label || '').toLowerCase();
  for (const cat of categories || []) {
    if ((cat.keywords || []).some((kw) => kw && l.includes(String(kw).toLowerCase()))) {
      return cat.name;
    }
  }
  return 'Autre';
}

/* Applique la catégorisation à une liste de transactions importées. */
export function categorizeAll(rows, categories) {
  return rows.map((r) => ({ ...r, category: categorize(r.label, categories) }));
}

/* Totaux de DÉPENSES (amount < 0) par catégorie, triés du plus gros au plus petit.
   Si `month` (AAAA-MM) est fourni, on ne compte que ce mois-là. */
export function spendingByCategory(data, month = null) {
  const txns = (data.transactions || []).filter((t) => t.amount < 0 && (!month || (t.date || '').startsWith(month)));
  const map = new Map();
  for (const t of txns) {
    const cat = t.category || 'Autre';
    map.set(cat, (map.get(cat) || 0) + Math.abs(t.amount));
  }
  const items = [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  const total = items.reduce((s, x) => s + x.total, 0);
  return { items, total, count: txns.length };
}

/* Liste des mois (AAAA-MM) présents dans les transactions, plus récent d'abord. */
export function availableMonths(data) {
  const set = new Set((data.transactions || []).map((t) => (t.date || '').slice(0, 7)).filter(Boolean));
  return [...set].sort().reverse();
}

/* Garde-fous : nombre cochés / total. */
export function guardrailsProgress(data) {
  const items = data.guardrails || [];
  const done = items.filter((g) => g.done).length;
  return { done, total: items.length, pct: items.length ? (done / items.length) * 100 : 0 };
}
