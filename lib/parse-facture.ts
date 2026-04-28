import { classifierProduit, dominantCategorie } from "./categories";

/**
 * Parser texte facture fournisseur → structure typée.
 * Aucun appel IA — uniquement des regex robustes calibrées sur des
 * factures FR réelles (DPS Market, Metro, Transgourmet, MKH/Odoo,
 * Orange-style, Verger de Souama, etc.).
 *
 * Utilisé par /api/facture-parse-text (pipeline : extraction PDF côté
 * client + OCR fallback → texte brut → ce parser → ParsedFacture).
 */

export interface ParsedLigne {
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  total: number;
  tva_taux: number | null;
}

export interface TvaLigneRecap {
  taux: number;
  base_ht: number;
  montant_tva: number;
  ttc: number | null;
}

export interface ParsedFacture {
  fournisseur: {
    nom: string | null;
    siret: string | null;
    adresse: string | null;
    telephone: string | null;
    email: string | null;
    tva_intra: string | null;
  };
  numero_facture: string | null;
  date: string | null;
  date_echeance: string | null;
  lignes: ParsedLigne[];
  tva_recap: TvaLigneRecap[];
  montant_ht: number | null;
  tva: number | null;
  montant_ttc: number | null;
  categorie_dominante: string | null;
}

// ─── Helpers bas niveau ─────────────────────────────────────────

export function parseMontant(s: string | undefined | null): number | null {
  if (s == null) return null;
  let cleaned = String(s)
    .replace(/ /g, "")
    .replace(/\s+/g, "")
    .replace(/€/g, "")
    .replace(/[^-0-9.,]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    cleaned = cleaned.replace(",", ".");
  }

  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

export function parseDateFr(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  const yRaw = m[3];
  const yyyy = yRaw.length === 2 ? (Number(yRaw) > 50 ? 1900 + Number(yRaw) : 2000 + Number(yRaw)) : Number(yRaw);
  if (yyyy < 1990 || yyyy > 2100) return null;
  return `${yyyy}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = parseInt(siret[i], 10);
    if (i % 2 === 0) d *= 2;
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

// ─── Extraction d'en-tête / pied ────────────────────────────────

function matchNumero(text: string): string | null {
  // Patterns par ordre de spécificité décroissante.
  // CHAQUE pattern accepte numéros mixtes (lettres+chiffres) ET tout-chiffres,
  // pourvu qu'au moins un chiffre soit présent.
  const patterns: RegExp[] = [
    // Odoo : "FAC/2025/02999" ou "RFAC/2025/00149"
    /(?:PRO\s*FORMA\s+)?(?:Facture|Avoir)\s+([A-Z]{1,6}\/\d{4}\/\d{3,6})/i,
    // "Numéro de facture: XYZ" / "Numéro de facture : XYZ" (UberEats, Vistaprint)
    /Num[ée]ro\s+de\s+facture\s*[:.]?\s*([A-Z0-9][A-Z0-9\-_\/.]{2,40})/i,
    // "N° de facture: XYZ"
    /N[°oº]\s+de\s+facture\s*[:.]?\s*([A-Z0-9][A-Z0-9\-_\/.]{2,40})/i,
    // "FACTURE N° XYZ" / "Facture N° XYZ" même sur la même ligne, sans
    // chevaucher des mots blacklistés (utilise lookahead négatif).
    /(?:FACTURE|FACT|FAC)\s*N[°oº]\s*[:.]?\s*(?!Date\b|Client\b)([A-Z0-9][A-Z0-9\-_\/]{2,40})/i,
    // "Facture XYZ" sans label intermédiaire (mais lettre+chiffre prioritaire)
    /(?:FACTURE|FACT|FAC)\s*(?:NO|NUM[ÉE]RO)?\s*[:.]?\s*([A-Z]{1,6}[\-_ ]?\d{2,}[A-Z0-9\-_]*)/i,
    // "N° XYZ" générique avec préfixe lettre
    /\bN[°oº]\s*[:.]?\s*([A-Z]{1,4}\d[A-Z0-9\-]{2,20})\b/i,
    // "facture (n°) : XYZ" avec lettre au début
    /facture\s*(?:n[°o]?\s*)?[:\-]?\s*([A-Z]{1,6}[\-_]?\d[A-Z0-9\/\-_]{2,20})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m || !m[1]) continue;
    const candidate = m[1].trim().replace(/\s+/g, "").replace(/[.,]$/, "");
    if (!/\d/.test(candidate)) continue;
    if (/^(DATE|CLIENT|FACTURE|TOTAL|PAGE|NUM|RCS|EUR|TVA|HT|TTC)$/i.test(candidate)) continue;
    if (candidate.length < 3 || candidate.length > 40) continue;
    return candidate;
  }
  // Fallback : label "Facture N°" puis numéro sur la ligne suivante (Verger,
  // Pain Tordu : tableau en colonnes, le numéro est dessous le label).
  // On itère sur les matches successifs et on skippe les mots blacklistés.
  const labelM = text.match(/Facture\s+N[°oº]/i);
  if (labelM) {
    const after = text.slice(labelM.index! + labelM[0].length, labelM.index! + labelM[0].length + 350);
    const re = /\b([A-Z0-9][A-Z0-9\-_]{2,30})\b/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(after)) !== null) {
      const c = mm[1];
      if (!/\d/.test(c)) continue;
      if (/^(DATE|CLIENT|FACTURE|TOTAL|PAGE|NUM|RCS|EUR|TVA|HT|TTC|EUROS|VENEZIA|RUE|AVENUE)$/i.test(c)) continue;
      if (c.length < 4) continue;
      // Skip dates pures (07/09/2024 etc.) — pas comme "FC3969"
      if (/^\d{1,2}[\/\-\.]\d{1,2}/.test(c)) continue;
      return c;
    }
  }

  // Fallback 2 : en-tête tableau "Facture ... Date ... Client" (cas
  // KEDY PACK : "Facture                Date              Client" suivi
  // d'une ligne avec le numéro, la date, le n° client).
  const labelM2 = text.match(/Facture\s{2,}Date\s{2,}Client/i);
  if (labelM2) {
    const after = text.slice(labelM2.index! + labelM2[0].length, labelM2.index! + labelM2[0].length + 400);
    const re = /\b([A-Z]{1,6}\d{3,}|\d{6,15})\b/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(after)) !== null) {
      const c = mm[1];
      if (/^\d{1,2}[\/\-\.]\d{1,2}/.test(c)) continue;
      if (c.length >= 4 && c.length <= 30) return c;
    }
  }
  return null;
}

function matchDate(text: string): { date: string | null; dateEcheance: string | null } {
  function findAllAfter(labelRe: RegExp, windowSize = 250): string[] {
    const m = text.match(labelRe);
    if (!m) return [];
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + windowSize);
    const out: string[] = [];
    let dm: RegExpExecArray | null;
    const re = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g;
    while ((dm = re.exec(after)) !== null) {
      const parsed = parseDateFr(dm[1]);
      if (parsed) out.push(parsed);
    }
    return out;
  }

  const echeanceCandidates =
    findAllAfter(/date\s+d[''\s]?[eé]ch[eé]ance\s*[:.]?/i)
      .concat(findAllAfter(/[eé]ch[eé]ance\s*[:.]?/i))
      .concat(findAllAfter(/[aà]\s+payer\s+avant\s*[:.]?/i))
      .concat(findAllAfter(/r[èe]glement\s+(?:au|le)\s*[:.]?/i));
  const dateEcheance: string | null = echeanceCandidates[0] ?? null;

  const factureCandidates =
    findAllAfter(/date\s+de\s+(?:la\s+)?facture\s*[:.]?/i)
      .concat(findAllAfter(/date\s+facture\s*[:.]?/i))
      .concat(findAllAfter(/date\s+(?:d[''\s]?)?[eé]mission\s*[:.]?/i))
      .concat(findAllAfter(/(?:emise?\s+le|en\s+date\s+du|facture\s+du)\s*[:.]?/i));

  let date: string | null = null;
  const filtered = dateEcheance
    ? factureCandidates.filter(d => d !== dateEcheance)
    : factureCandidates;
  if (filtered.length > 0) {
    date = filtered.sort()[0] ?? null;
  } else if (factureCandidates.length > 0) {
    date = factureCandidates.sort()[0] ?? null;
  }

  if (!date) {
    const re = /(?:^|[^\d.])(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})(?:[^\d]|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const ctxBefore = text.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
      if (/(?:t[ée]l|tel|☎|\+33|capital|rcs)/.test(ctxBefore)) continue;
      const parsed = parseDateFr(m[1]);
      if (parsed) { date = parsed; break; }
    }
  }

  return { date, dateEcheance };
} 
function matchSiret(text: string): string | null {
  const labeled = text.match(/\bSIRET\s*[:.]?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5}|\d{14})\b/i);
  if (labeled) {
    const s = labeled[1].replace(/\s/g, "");
    if (s.length === 14) return s;
  }
  const re = /\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5}|\d{14})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[1].replace(/\s/g, "");
    if (s.length === 14 && isValidSiret(s)) return s;
  }
  return null;
}

function matchTvaIntra(text: string): string | null {
  const m = text.match(/\b(FR\s?\d{2}\s?\d{9})\b/i);
  return m ? m[1].replace(/\s/g, "").toUpperCase() : null;
}

function matchTelephone(text: string): string | null {
  const m = text.match(/(?:T[éeé]l(?:[ée]phone)?|☎)\s*[:.]?\s*((?:\+33\s?|0)[1-9](?:[.\s\-]?\d{2}){4})/i);
  if (m) return m[1].replace(/\s+/g, " ").trim();
  return null;
}

function matchEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

function matchTotaux(text: string): { ht: number | null; tva: number | null; ttc: number | null } {
  const lower = text.length > 800
    ? text.slice(Math.floor(text.length * 0.45))
    : text;

  const reHT = [
    /total\s+(?:net\s+)?h\.?t\.?\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
    /montant\s+hors\s+taxes\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
    /montant\s+h\.?t\.?\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
    /\bnet\s+ht\b\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
  ];
  const reTVA = [
    /total\s+t\.?v\.?a\.?(?:\s*\([\d.,]+\s*%\))?\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
    /\btotal\s+tva\b\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
  ];
  const reTTC = [
    /(?:total\s+)?(?:net\s+[aà]\s+payer|net\s+a\s+payer)\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
    /\b(?:t\.?t\.?c\.?|montant\s+ttc|total\s+ttc)\s*[:=.]?\s*([\d\s.]+[,\.]\d{2})/i,
  ];
  const findFirst = (regexes: RegExp[]): number | null => {
    for (const r of regexes) {
      const m = lower.match(r);
      if (m) {
        const n = parseMontant(m[1]);
        if (n != null) return n;
      }
    }
    return null;
  };
  return {
    ht: findFirst(reHT),
    tva: findFirst(reTVA),
    ttc: findFirst(reTTC),
  };
}

// ─── Nom du fournisseur (émetteur) ──────────────────────────────

const FORMES_JURIDIQUES = /\b(SARL|SAS|SASU|SA|EURL|EI|EIRL|SCI|SNC|SCOP|SCM|SCEA|SC|GIE|UPA|S\.A\.S|S\.A\.R\.L|E\.U\.R\.L)\b/i;

const NOM_BLACKLIST = /^(facture|client|date|n[°oº]|page|total|siret|tva|---|adresse|livraison|destinataire|d[ée]signation|quantit|unit[ée]|prix|montant|description|code\s+art|code\s+postal|t[ée]l|tel|email|courriel|si[èe]ge|capital|rcs|origine|r[ée]f[ée]rence|num[ée]ro)/i;

function matchFournisseurNom(text: string): string | null {
  // Pré-traitement : pour chaque ligne large contenant ≥5 espaces
  // consécutifs (en-têtes en colonnes), on isole chaque colonne.
  // Couvre Verger : "E.U.R.L. VERGER DE SOUAMA   Facture N°  Date  Client".
  const rawLines = text.split(/\r?\n/).map(l => l.trimEnd());
  const lines: string[] = [];
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (raw.length > 60 && /\s{5,}/.test(raw)) {
      const cols = raw.split(/\s{5,}/).map(c => c.trim()).filter(Boolean);
      for (const c of cols) lines.push(c);
    } else {
      lines.push(trimmed);
    }
  }

  function looksLikeName(s: string): boolean {
    if (s.length < 4 || s.length > 80) return false;
    if (NOM_BLACKLIST.test(s)) return false;
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(s)) return false;
    if (/^\d{1,4}[\s,]+(rue|avenue|boulevard|bd|chemin|impasse|all[ée]e|place|pl)\b/i.test(s)) return false;
    if (/^\d{5}\s+[A-Za-zÀ-ÿ]/.test(s)) return false;
    if (s.includes("@") || /^https?:/i.test(s)) return false;
    if (/^[\d\s.\-+]{8,}$/.test(s)) return false;
    if (/^[A-Z]{1,4}(\.\d)?$/.test(s)) return false;
    return true;
  }

  const destinataireMarkers = /(adresse\s+de\s+livraison|livr[ée]\s+[aà]|factur[ée]\s+[aà]|destinataire|client\s*:)/i;

  const skipIdx = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (destinataireMarkers.test(lines[i])) {
      for (let j = i; j < Math.min(lines.length, i + 6); j++) {
        skipIdx.add(j);
        if (/^\d{5}\s+/.test(lines[j])) break;
      }
    }
  }

  const candidates: { score: number; idx: number; nom: string }[] = [];
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (skipIdx.has(i)) continue;
    const l = lines[i];
    if (!looksLikeName(l)) continue;
    // Position très importante : l'émetteur est presque toujours en
    // tête du document.
    let score = Math.max(0, 30 - i * 2);
    if (FORMES_JURIDIQUES.test(l)) score += 8;
    if (/[A-Z]{4,}/.test(l)) score += 4;
    const next1 = lines[i + 1] ?? "";
    const next2 = lines[i + 2] ?? "";
    const hasStreet = (s: string) => /^\d{1,4}[,\s]+(rue|avenue|bd|boulevard|chemin|impasse|all[ée]e|place|pl|av\.)\b/i.test(s);
    const hasCP = (s: string) => /^\d{5}\b/.test(s);
    if (hasStreet(next1) || hasStreet(next2)) score += 6;
    if (hasCP(next1) || hasCP(next2)) score += 4;
    candidates.push({ score, idx: i, nom: l });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return candidates[0].nom;
}

// ─── Récap TVA ──────────────────────────────────────────────────

function matchTvaRecap(text: string): TvaLigneRecap[] {
  const out: TvaLigneRecap[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim());

  // Pattern 1 : "TVA X% sur BASE € MONTANT €" (Odoo MKH)
  const reSur = /(?:TVA\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s+sur\s+([\d\s.]+[.,]\d{2})\s*€?\s+([\d\s.]+[.,]\d{2})\s*€?/i;
  // Pattern 2 : 3 ou 4 colonnes "TAUX% BASE TVA [TTC]"
  const re3col = /(?:TVA\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s+([\d\s.]+[.,]\d{2})\s+([\d\s.]+[.,]\d{2})(?:\s+([\d\s.]+[.,]\d{2}))?/i;
  // Pattern 3 : Verger "CODE BASE TAUX MONTANT" — code TVA en premier (1-2 chiffres)
  const reVerger = /^\s*(\d{1,2})\s+([\d\s.]+[.,]\d{2})\s+(\d{1,2}[.,]\d{1,2})\s+([\d\s.]+[.,]\d{2})\s*$/;

  // Pré-traitement : pour les lignes très larges contenant le récap TVA
  // ET d'autres colonnes (cas Pain Tordu : "2 372,60 5,50 20,49     Net HT
  // 372,60" sur la même ligne), on split sur de GROS gaps (≥15 espaces) qui
  // séparent les colonnes principales — sans casser un récap "2 BASE TAUX
  // MONTANT" qui n'a que ~5-15 espaces entre les chiffres.
  const candidateLines: string[] = [];
  for (const raw of lines) {
    if (!raw) continue;
    candidateLines.push(raw); // toujours essayer la ligne entière d'abord
    if (raw.length > 100 && /\s{25,}/.test(raw)) {
      for (const col of raw.split(/\s{25,}/)) {
        const t = col.trim();
        if (t && t.length <= 120 && t !== raw.trim()) candidateLines.push(t);
      }
    }
  }

  for (const raw of candidateLines) {
    if (!raw || raw.length > 120) continue;

    let m = raw.match(reSur);
    if (m) {
      const taux = parseMontant(m[1]);
      const base_ht = parseMontant(m[2]);
      const montant_tva = parseMontant(m[3]);
      if (taux != null && base_ht != null && montant_tva != null && taux >= 0 && taux <= 30) {
        out.push({ taux, base_ht, montant_tva, ttc: Math.round((base_ht + montant_tva) * 100) / 100 });
        continue;
      }
    }

    m = raw.match(reVerger);
    if (m) {
      const taux = parseMontant(m[3]);
      const base_ht = parseMontant(m[2]);
      const montant_tva = parseMontant(m[4]);
      if (taux != null && base_ht != null && montant_tva != null && taux >= 0 && taux <= 30) {
        const expected = base_ht * (taux / 100);
        if (Math.abs(expected - montant_tva) / Math.max(montant_tva, 0.01) <= 0.05) {
          out.push({ taux, base_ht, montant_tva, ttc: Math.round((base_ht + montant_tva) * 100) / 100 });
          continue;
        }
      }
    }

    m = raw.match(re3col);
    if (m) {
      const taux = parseMontant(m[1]);
      const base_ht = parseMontant(m[2]);
      const montant_tva = parseMontant(m[3]);
      const ttc = m[4] ? parseMontant(m[4]) : null;
      if (taux == null || base_ht == null || montant_tva == null) continue;
      if (taux < 0 || taux > 30) continue;
      const expected = base_ht * (taux / 100);
      if (Math.abs(expected - montant_tva) / Math.max(montant_tva, 0.01) > 0.05) continue;
      out.push({
        taux,
        base_ht,
        montant_tva,
        ttc: ttc ?? Math.round((base_ht + montant_tva) * 100) / 100,
      });
    }
  }

  const seen = new Map<number, TvaLigneRecap>();
  for (const l of out) {
    if (!seen.has(l.taux) || l.base_ht > (seen.get(l.taux)?.base_ht ?? 0)) seen.set(l.taux, l);
  }
  return Array.from(seen.values()).sort((a, b) => a.taux - b.taux);
}

// ─── Parsing lignes produits ────────────────────────────────────

const DPS_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`([A-Z]{1,6}\d{3,8})\s+` +
    String.raw`(.+?)\s+` +
    String.raw`(\d{1,2}(?:[.,]\d{1,2})?)\s+` +
    String.raw`(\d+(?:[.,]\d+)?)\s+` +
    String.raw`([A-Z]{1,5})\s+` +
    String.raw`(\d+(?:[.,]\d+)?)\s+` +
    String.raw`([\d]+[.,]\d{1,4})\s+` +
    String.raw`([\d]+[.,]\d{2})\s+` +
    String.raw`(?:(\d+(?:[.,]\d+)?)\s+)?` +
    String.raw`([\d\s]*\d[.,]\d{2})\s*$`,
);

const ORANGE_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`([A-Z0-9]{3,12})\s+` +
    String.raw`(.+?)\s+` +
    String.raw`(\d{1,2}(?:[.,]\d{1,2})?)\s+` +
    String.raw`(\d+(?:[.,]\d+)?)\s+` +
    String.raw`([A-Z]{1,5})\s+` +
    String.raw`([\d]+[.,]\d{1,4})\s+` +
    String.raw`([\d\s]*\d[.,]\d{2})\s*$`,
);

const GEN_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`(.+?)\s+` +
    String.raw`(\d+(?:[.,]\d+)?)\s*` +
    String.raw`([A-Za-z]{1,5}|kg|pc|pce|u|l|g)\s+` +
    String.raw`([\d]+[.,]\d{1,4})\s+` +
    String.raw`([\d\s]*\d[.,]\d{2})\s*$`,
  "i",
);

const ODOO_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`\[([A-Za-z0-9_\-]+)\]\s+` +
    String.raw`(.+?)\s+` +
    String.raw`(\d+(?:[.,]\d+)?)\s+Unit[ée]?\(s\)\s+` +
    String.raw`(\d+(?:[.,]\d+)?)\s+` +
    String.raw`TVA\s+(\d+(?:[.,]\d+)?)\s*%\s+` +
    String.raw`(\d+[.,]\d{2})\s*€?\s*$`,
  "i",
);

const VERGER_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`([A-Z]{2,8})\s+` +
    String.raw`(.+?)\s+` +
    String.raw`(Pi[èe]ce|Pi[èe]ces|Kg|Botte|Carton|Litre|L|Sachet|Barquette|Unit[ée])\s+` +
    String.raw`(\d+(?:[.,]\d+)?)\s+` +
    String.raw`(\d+[.,]\d{2,4})\s+` +
    String.raw`([\d\s.]*\d[.,]\d{2})\s+` +
    String.raw`(\d{1,2})\s*$`,
  "i",
);

/**
 * Format Pain Tordu / boulangeries similaires :
 *   CODE | DESIGNATION… | QTE | PU | [%REM] [REMISE_HT] | TOTAL_HT | code-TVA(1-2 chiffres)
 *   ex : "AR0001 Baguette 250 gr 18,000 0,80 14,40 2"
 *   ex : "AR0001 Baguette 250 gr 11H 20,000 0,80 16,00 2"
 *
 * Code alphanumérique (lettres + chiffres). Pas d'unité.
 */
const PAIN_TORDU_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`([A-Z]{1,4}\d{3,8})\s+` +                    // 1: code (AR0001)
    String.raw`(.+?)\s+` +                                   // 2: désignation
    String.raw`(\d+(?:[.,]\d+)?)\s+` +                     // 3: quantité
    String.raw`(\d+[.,]\d{2,4})\s+` +                      // 4: PU
    String.raw`([\d\s.]*\d[.,]\d{2})\s+` +               // 5: total HT
    String.raw`(\d{1,2})\s*$`,                              // 6: code TVA
  "i",
);

/**
 * Format SCAPI / fournisseurs simples avec € en suffixe :
 *   DESIGNATION QTE PU€ TVA% TOTAL€
 *   ex : "MAINTENANCE EXTINCTEUR BASIC 3 30,00 € 20 % 90,00 €"
 *   ex : "EXTINCTEUR 2 KG CO2 1 130,00 € 20 % 130,00 €"
 *
 * Pas de code produit. PU et total ont "€" en suffixe.
 */
const SCAPI_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9 \-]{3,60}?)\s+` +       // 1: désignation MAJ
    String.raw`(\d+(?:[.,]\d+)?)\s+` +                     // 2: quantité
    String.raw`(\d+[.,]\d{2})\s*€\s+` +                   // 3: PU + €
    String.raw`(\d{1,2}(?:[.,]\d+)?)\s*%\s+` +            // 4: TVA %
    String.raw`(\d+[.,]\d{2})\s*€\s*$`,                   // 5: total + €
);

/**
 * Format SAFE TO EAT : ref + DESIGNATION + qté + [unité] + PU€ + REM% + MONT_HT€ + TVA%
 *   ex : "ART00000008 -Pack Hygiène 1,00 250,00 € 0,00% 250,00 € 20,00%"
 */
const SAFE_TO_EAT_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`([A-Z]{2,8}\d+)\s+` +                        // 1: ref ART00000008
    String.raw`-?\s*(.+?)\s+` +                             // 2: désignation
    String.raw`(\d+(?:[.,]\d+)?)\s+` +                     // 3: quantité
    String.raw`(?:[A-Za-z\/]+\s+)?` +                       // unité optionnelle
    String.raw`(\d+[.,]\d{2})\s*€?\s+` +                  // 4: PU
    String.raw`\d+[.,]?\d*\s*%\s+` +                      // remise (ignorée)
    String.raw`(\d+[.,]\d{2})\s*€?\s+` +                  // 5: montant HT
    String.raw`(\d{1,2}(?:[.,]\d+)?)\s*%?\s*$`,           // 6: TVA %
);

/**
 * Format KEDY PACK / similaires : ref + DESIGNATION + qté + UNITE + PU + REM% + MONT_HT + MONT_TTC + CODE_TVA
 *   ex : "IC110 Bac inox 1/3X1 3 1/Pièces 9,110 0.00% 27,33 32,79 1"
 */
const KEDY_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`([A-Z0-9]{2,12})\s+` +                        // 1: ref
    String.raw`(.+?)\s+` +                                   // 2: désignation
    String.raw`(\d+(?:[.,]\d+)?)\s+` +                     // 3: quantité
    String.raw`(\d+\/[A-Za-zé]+)\s+` +                     // 4: unité ("1/Pièces")
    String.raw`(\d+[.,]\d{1,4})\s+` +                      // 5: PU
    String.raw`\d+\.\d{1,2}%\s+` +                        // remise
    String.raw`(\d+[.,]\d{2})\s+` +                        // 6: mont HT
    String.raw`(\d+[.,]\d{2})\s+` +                        // 7: mont TTC
    String.raw`(\d{1,2})\s*$`,                              // 8: code TVA
);

const VERGER_TVA_CODE: Record<string, number> = {
  "1": 20,
  "2": 5.5,
  "3": 10,
  "4": 0,
};

function parseLignes(text: string, tvaRecap: TvaLigneRecap[]): ParsedLigne[] {
  const lignes: ParsedLigne[] = [];
  const rawLines = text.split(/\r?\n/);

  for (const raw of rawLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 10) continue;
    if (/^(total|sous[\s-]?total|tva|h\.?t\.?|ttc|net|acompte|remise|d[ée]signation|quantit|unit[ée]|prix|port\s|montant)/i.test(line)) continue;

    let m = ODOO_LINE_RE.exec(line);
    if (m) {
      const nom = m[2].trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(m[3]) ?? 0;
      const prixU = parseMontant(m[4]) ?? 0;
      const tvaPct = parseMontant(m[5]);
      const totalTxt = parseMontant(m[6]) ?? (quantite * prixU);
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite, unite: "u",
        prix_unitaire: prixU, total: totalTxt,
        tva_taux: tvaPct != null && tvaPct >= 0 && tvaPct <= 30 ? tvaPct : null,
      });
      continue;
    }

    m = VERGER_LINE_RE.exec(line);
    if (m) {
      const nom = m[2].trim();
      if (nom.length < 3) continue;
      const unite = m[3].toLowerCase();
      const quantite = parseMontant(m[4]) ?? 0;
      const prixU = parseMontant(m[5]) ?? 0;
      const total = parseMontant(m[6]) ?? (quantite * prixU);
      const tvaCode = m[7];
      let tvaTaux: number | null = VERGER_TVA_CODE[tvaCode] ?? null;
      if (tvaRecap.length === 1) tvaTaux = tvaRecap[0].taux;
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite, unite,
        prix_unitaire: prixU, total, tva_taux: tvaTaux,
      });
      continue;
    }

    // 2.b) Pattern Pain Tordu (Verger sans unité)
    m = PAIN_TORDU_LINE_RE.exec(line);
    if (m) {
      const nom = m[2].trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(m[3]) ?? 0;
      const prixU = parseMontant(m[4]) ?? 0;
      const total = parseMontant(m[5]) ?? (quantite * prixU);
      const tvaCode = m[6];
      let tvaTaux: number | null = VERGER_TVA_CODE[tvaCode] ?? null;
      if (tvaRecap.length === 1) tvaTaux = tvaRecap[0].taux;
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite, unite: "u",
        prix_unitaire: prixU, total, tva_taux: tvaTaux,
      });
      continue;
    }

    // 2.c) Pattern Kedy Pack (ref + unité fractionnaire + remise + 2 montants + code TVA)
    m = KEDY_LINE_RE.exec(line);
    if (m) {
      const nom = m[2].trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(m[3]) ?? 0;
      const unite = m[4].toLowerCase();
      const prixU = parseMontant(m[5]) ?? 0;
      const total = parseMontant(m[6]) ?? (quantite * prixU);
      const tvaCode = m[8];
      let tvaTaux: number | null = VERGER_TVA_CODE[tvaCode] ?? null;
      if (tvaRecap.length === 1) tvaTaux = tvaRecap[0].taux;
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite, unite,
        prix_unitaire: prixU, total, tva_taux: tvaTaux,
      });
      continue;
    }

    // 2.d) Pattern SAFE TO EAT (ref + qté + PU€ + REM% + montant + TVA%)
    m = SAFE_TO_EAT_LINE_RE.exec(line);
    if (m) {
      const nom = m[2].trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(m[3]) ?? 0;
      const prixU = parseMontant(m[4]) ?? 0;
      const total = parseMontant(m[5]) ?? (quantite * prixU);
      const tvaPct = parseMontant(m[6]);
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite, unite: "u",
        prix_unitaire: prixU, total,
        tva_taux: tvaPct != null && tvaPct >= 0 && tvaPct <= 30 ? tvaPct : null,
      });
      continue;
    }

    // 2.e) Pattern SCAPI (DESIGNATION QTE PU€ TVA% TOTAL€)
    m = SCAPI_LINE_RE.exec(line);
    if (m) {
      const nom = m[1].trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(m[2]) ?? 0;
      const prixU = parseMontant(m[3]) ?? 0;
      const tvaPct = parseMontant(m[4]);
      const total = parseMontant(m[5]) ?? (quantite * prixU);
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite, unite: "u",
        prix_unitaire: prixU, total,
        tva_taux: tvaPct != null && tvaPct >= 0 && tvaPct <= 30 ? tvaPct : null,
      });
      continue;
    }

    m = ORANGE_LINE_RE.exec(line);
    if (m) {
      const nom = m[2].trim();
      if (nom.length < 3) continue;
      const tvaPct = parseMontant(m[3]);
      const quantite = parseMontant(m[4]) ?? 0;
      const unite = m[5].toLowerCase().trim() || "u";
      const prixU = parseMontant(m[6]) ?? 0;
      const total = parseMontant(m[7]) ?? (quantite * prixU);
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite, unite,
        prix_unitaire: prixU, total,
        tva_taux: tvaPct != null && tvaPct >= 0 && tvaPct <= 30 ? tvaPct : null,
      });
      continue;
    }

    m = DPS_LINE_RE.exec(line);
    if (m) {
      const nom = m[2].trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(m[4]) ?? 0;
      const unite = m[5];
      const prixU = parseMontant(m[7]) ?? 0;
      const total = parseMontant(m[10]) ?? (quantite * prixU);
      const tvaPct = parseMontant(m[3]);
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite,
        unite: unite.toLowerCase().trim() || "pce",
        prix_unitaire: prixU, total,
        tva_taux: tvaPct != null && tvaPct >= 0 && tvaPct <= 30 ? tvaPct : null,
      });
      continue;
    }

    m = GEN_LINE_RE.exec(line);
    if (m) {
      const [, designation, qte, unite, pu, totalHT] = m;
      const nom = designation.trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(qte) ?? 0;
      const prixU = parseMontant(pu) ?? 0;
      const total = parseMontant(totalHT) ?? (quantite * prixU);
      if (total <= 0 || quantite <= 0 || prixU <= 0) continue;
      lignes.push({
        nom, categorie: classifierProduit(nom), quantite,
        unite: unite.toLowerCase().trim() || "pce",
        prix_unitaire: prixU, total, tva_taux: null,
      });
    }
  }
  return lignes;
}

// ─── API publique ───────────────────────────────────────────────

export function parseOneFacture(text: string): ParsedFacture {
  const { date, dateEcheance } = matchDate(text);
  const totaux = matchTotaux(text);
  const tvaRecap = matchTvaRecap(text);
  const lignes = parseLignes(text, tvaRecap);

  if (tvaRecap.length === 1) {
    const t = tvaRecap[0].taux;
    for (const l of lignes) if (l.tva_taux == null) l.tva_taux = t;
  }

  const tvaSumRecap = tvaRecap.length > 0
    ? Math.round(tvaRecap.reduce((s, l) => s + l.montant_tva, 0) * 100) / 100
    : null;

  return {
    fournisseur: {
      nom: matchFournisseurNom(text),
      siret: matchSiret(text),
      adresse: null,
      telephone: matchTelephone(text),
      email: matchEmail(text),
      tva_intra: matchTvaIntra(text),
    },
    numero_facture: matchNumero(text),
    date,
    date_echeance: dateEcheance,
    lignes,
    tva_recap: tvaRecap,
    montant_ht: totaux.ht,
    tva: tvaSumRecap ?? totaux.tva,
    montant_ttc: totaux.ttc
      ?? (totaux.ht != null && (tvaSumRecap ?? totaux.tva) != null
            ? Math.round((totaux.ht + (tvaSumRecap ?? totaux.tva ?? 0)) * 100) / 100
            : null),
    categorie_dominante: dominantCategorie(lignes),
  };
}

export function splitFactures(text: string): string[] {
  const re = /(?:^|\n)[^\n]*\b(?:FACTURE|Facture)\s*(?:N[°oº]|NO|NUM|FAC)/g;
  const markers: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) markers.push(m.index);

  if (markers.length <= 1) return [text];

  const blocks: { start: number; end: number; text: string; numero: string | null }[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i];
    const end = i + 1 < markers.length ? markers[i + 1] : text.length;
    const blockText = text.slice(start, end);
    blocks.push({ start, end, text: blockText, numero: matchNumero(blockText) });
  }

  const distincts = new Set(blocks.map(b => b.numero).filter((n): n is string => !!n));
  if (distincts.size <= 1) {
    return [text];
  }

  const byNumero = new Map<string, string>();
  let lastNumero: string | null = null;
  for (const b of blocks) {
    const key = b.numero ?? lastNumero ?? "_unknown";
    byNumero.set(key, (byNumero.get(key) ?? "") + b.text);
    if (b.numero) lastNumero = b.numero;
  }
  return Array.from(byNumero.values());
}

export function parseFactureText(text: string): ParsedFacture[] {
  const blocks = splitFactures(text);
  const result = blocks
    .map(parseOneFacture)
    .filter(f =>
      f.lignes.length > 0
      || f.numero_facture
      || f.fournisseur.nom
      || f.montant_ttc != null
      || f.montant_ht != null,
    );
  if (result.length === 0 && blocks.length > 0) {
    return [parseOneFacture(blocks[0])];
  }
  return result;
}
