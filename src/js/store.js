/* store.js — persistance 100 % locale (localStorage). Rien ne part en ligne.
   Le store exporté/importé a la même forme que data.json / data.example.json. */

export const STORAGE_KEY = 'road2m.data.v1';

/* Valeurs par défaut = mêmes champs que data.example.json, mais neutres (zéros).
   On NE met PAS de vrais montants ici : c'est du code versionné. */
export const DEFAULT_DATA = {
  settings: {
    cushion_target_eur: 1500,
    daily_cash_cap_eur: 20,
    low_balance_threshold_eur: 200,
    etf_reduced_weekly_eur: 50,
    etf_sustainable_weekly_eur: 100
  },
  income: { salary_eur: 0 },
  balances: { cushion_cash_eur: 0, tr_cash_eur: 0 },
  etf: { current_weekly_eur: 0, buy_planned: false },
  fixed_charges: [
    { label: 'Virement compte commun', amount_eur: 0 },
    { label: 'Prêt papa (0%)', amount_eur: 0 },
    { label: 'Épargne enfant', amount_eur: 0 }
  ],
  accounts: [
    { id: 'tr', name: 'Trade Republic', type: 'cash+invest', rate: 2.25 },
    { id: 'main', name: 'Compte principal', type: 'courant' },
    { id: 'common', name: 'Compte commun', type: 'courant' },
    { id: 'savings', name: 'Épargne classique', type: 'epargne', rate: 0.4 }
  ],
  loan_family: {
    label: 'Prêt papa (0%)',
    monthly_eur: 0,
    start: '',
    end: '',
    accelerate: false
  },
  guardrails: [
    { key: 'no_mobile_pay', label: 'Apple/Google Pay retiré du téléphone', done: false },
    { key: 'card_stored', label: 'Carte physique rangée (pas sur moi)', done: false },
    { key: 'daily_cash', label: 'Plafond cash quotidien en place', done: false },
    { key: 'epis', label: 'Auto-exclusion EPIS demandée (gamingcommission.be)', done: false },
    { key: 'blocker', label: 'Bloqueur de sites de jeu installé (Stop Jeu / Gamban)', done: false },
    { key: 'trusted_person', label: 'Une personne de confiance est au courant', done: false }
  ],
  subscriptions: [],
  transactions: [],
  gambling_free_since: null
};

/* Fusion profonde simple : garantit que les nouvelles clés du schéma
   apparaissent même sur d'anciens stores. Les tableaux sont remplacés tels quels
   (sauf s'ils sont absents, auquel cas on prend le défaut). */
function merge(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (override && typeof override === 'object') {
      for (const k of Object.keys(override)) {
        out[k] = k in base ? merge(base[k], override[k]) : override[k];
      }
    }
    return out;
  }
  return override === undefined ? base : override;
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    return merge(structuredClone(DEFAULT_DATA), JSON.parse(raw));
  } catch (e) {
    console.warn('Store illisible, réinitialisation locale.', e);
    return structuredClone(DEFAULT_DATA);
  }
}

export function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetToDefault() {
  const fresh = structuredClone(DEFAULT_DATA);
  save(fresh);
  return fresh;
}

/* Import depuis un objet JSON (fichier choisi par l'utilisateur). */
export function importData(obj) {
  const merged = merge(structuredClone(DEFAULT_DATA), obj);
  save(merged);
  return merged;
}

/* Export : renvoie une chaîne JSON joliment formatée (= ton data.json). */
export function exportString(data) {
  return JSON.stringify(data, null, 2);
}
