/* csv.js — parsing CSV 100 % local (rien n'est envoyé). Conçu pour digérer les
   exports Beobank et Trade Republic sans configuration : détection du séparateur,
   des colonnes (date / libellé / montant) et des nombres au format européen. */

/* Découpe une ligne CSV en respectant les guillemets. */
function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectDelimiter(headerLine) {
  const counts = { ';': 0, ',': 0, '\t': 0 };
  for (const d of Object.keys(counts)) counts[d] = headerLine.split(d).length - 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ';';
}

/* Trouve l'index d'une colonne d'après une liste de mots-clés (insensible casse/accents). */
function findCol(headers, keywords) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const H = headers.map(norm);
  for (const kw of keywords) {
    const k = norm(kw);
    const idx = H.findIndex((h) => h.includes(k));
    if (idx !== -1) return idx;
  }
  return -1;
}

/* Parse un nombre au format européen ("1.234,56" / "1 234,56" / "-12,30") ou anglo. */
export function parseAmount(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/\s|€|EUR/gi, '');
  if (!s) return NaN;
  const neg = /^-/.test(s) || /\(.*\)/.test(s);
  s = s.replace(/[()]/g, '').replace(/^-/, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // virgule = décimale (européen)
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // point = décimale (anglo) — on retire les virgules de milliers
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return NaN;
  return neg ? -n : n;
}

/* Normalise une date vers AAAA-MM-JJ (gère JJ/MM/AAAA, JJ-MM-AAAA, AAAA-MM-JJ). */
function parseDate(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

const DATE_KEYS = ['date comptable', 'date valeur', 'date', 'datum', 'booking', 'execution'];
const LABEL_KEYS = ['communication', 'libelle', 'libellé', 'description', 'detail', 'détail',
  'contrepartie', 'beneficiaire', 'bénéficiaire', 'name', 'nom', 'omschrijving', 'tegenpartij', 'type'];
const AMOUNT_KEYS = ['montant', 'amount', 'bedrag', 'value', 'valeur', 'somme'];
const DEBIT_KEYS = ['debit', 'débit', 'debet', 'sortie', 'uit'];
const CREDIT_KEYS = ['credit', 'crédit', 'entree', 'entrée', 'in'];

/* Parse le texte d'un CSV -> liste de transactions { date, label, amount }.
   amount < 0 = dépense, > 0 = entrée. */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = clean.split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return { rows: [], warning: 'Fichier vide ou sans données.' };

  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);

  const iDate = findCol(headers, DATE_KEYS);
  const iLabel = findCol(headers, LABEL_KEYS);
  const iAmount = findCol(headers, AMOUNT_KEYS);
  const iDebit = findCol(headers, DEBIT_KEYS);
  const iCredit = findCol(headers, CREDIT_KEYS);

  if (iAmount === -1 && iDebit === -1 && iCredit === -1) {
    return { rows: [], warning: `Colonne de montant introuvable. En-têtes vus : ${headers.join(' | ')}` };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    if (cells.length < headers.length - 1) continue;

    let amount = NaN;
    if (iAmount !== -1) amount = parseAmount(cells[iAmount]);
    if (!Number.isFinite(amount) && (iDebit !== -1 || iCredit !== -1)) {
      const deb = iDebit !== -1 ? parseAmount(cells[iDebit]) : NaN;
      const cred = iCredit !== -1 ? parseAmount(cells[iCredit]) : NaN;
      if (Number.isFinite(deb) && deb !== 0) amount = -Math.abs(deb);
      else if (Number.isFinite(cred) && cred !== 0) amount = Math.abs(cred);
    }
    if (!Number.isFinite(amount)) continue;

    const label = iLabel !== -1 ? cells[iLabel] : (cells.find((c) => c && isNaN(parseAmount(c))) || '');
    rows.push({
      date: iDate !== -1 ? parseDate(cells[iDate]) : '',
      label: label.replace(/\s+/g, ' ').trim(),
      amount: Math.round(amount * 100) / 100
    });
  }
  return { rows, headers, mapping: { iDate, iLabel, iAmount, iDebit, iCredit } };
}
