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

// ─── Catégorisation heuristique ─────────────────────────────────

const CAT_KW: { cat: string; kws: string[] }[] = [
  { cat: "boucherie", kws: ["boeuf","bœuf","veau","agneau","porc","poulet","volaille","charcuterie","jambon","saucisse","côte","cote","entrecote","entrecôte","filet","escalope","dinde","canard","rumsteck","bavette","lardon","chorizo"] },
  { cat: "poissonnerie", kws: ["poisson","saumon","cabillaud","thon","crevette","langoustine","huitre","huître","moule","bar","dorade","sole","lotte","crustace","crustacé","bulot","calamar"] },
  { cat: "fruits", kws: ["pomme","poire","banane","orange","citron","fraise","framboise","raisin","cerise","peche","pêche","abricot","ananas","mangue","kiwi","melon","pasteque","pastèque"] },
  { cat: "legumes", kws: ["tomate","courgette","aubergine","poivron","oignon","ail","carotte","poireau","haricot","champignon","epinard","épinard","brocoli","chou","concombre","radis","betterave"] },
  { cat: "pommes_de_terre", kws: ["pomme de terre","patate","grenaille","charlotte","agria","bintje"] },
  { cat: "salades", kws: ["salade","laitue","roquette","mesclun","scarole","mache","mâche","frisee","frisée","endive"] },
  { cat: "herbes", kws: ["persil","basilic","menthe","ciboulette","coriandre","thym","romarin","estragon","aneth","sauge","origan"] },
  { cat: "cremerie", kws: ["lait","beurre","creme","crème","fromage","yaourt","oeuf","œuf","camembert","comte","comté","mozzarella","parmesan","gruyere"] },
];

function guessCat(nom: string): string {
  const n = nom.toLowerCase();
  for (const { cat, kws } of CAT_KW) {
    if (kws.some(k => n.includes(k))) return cat;
  }
  return "epicerie";
}

// ─── Extraction d'en-tête / pied ────────────────────────────────

function matchNumero(text: string): string | null {
  const patterns: RegExp[] = [
    /(?:PRO\s*FORMA\s+)?(?:Facture|Avoir)\s+([A-Z]{1,6}\/\d{4}\/\d{3,6})/i,
    /(?:FACTURE|FACT|FAC)\s*(?:N[°oº]|NO|NUM[ÉE]RO)?\s*[:.]?\s*([A-Z]{1,6}[\-_ ]?\d{2,}[A-Z0-9\-_]*)/i,
    /\bN[°oº]\s*[:.]?\s*([A-Z]{1,4}\d[A-Z0-9\-]{2,20})\b/i,
    /facture\s*(?:n[°o]?\s*)?[:\-]?\s*([A-Z]{1,6}[\-_]?\d[A-Z0-9\/\-_]{2,20})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m || !m[1]) continue;
    const candidate = m[1].trim().replace(/\s+/g, "");
    if (!/\d/.test(candidate)) continue;
    if (/^(DATE|CLIENT|FACTURE|TOTAL|PAGE|NUM|RCS)/i.test(candidate)) continue;
    return candidate;
  }
  // Fallback : label "Facture N°" puis numéro sur ligne suivante (Verger)
  const labelM = text.match(/Facture\s+N[°oº]/i);
  if (labelM) {
    const after = text.slice(labelM.index! + labelM[0].length, labelM.index! + labelM[0].length + 250);
    const nm = after.match(/\b([A-Z]{1,6}[\-_]?\d{2,}[A-Z0-9\-]*)\b/);
    if (nm && /\d/.test(nm[1]) && !/^(DATE|CLIENT|FACTURE|TOTAL|PAGE|NUM|RCS)/i.test(nm[1])) {
      return nm[1];
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
        nom, categorie: guessCat(nom), quantite, unite: "u",
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
        nom, categorie: guessCat(nom), quantite, unite,
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
        nom, categorie: guessCat(nom), quantite, unite: "u",
        prix_unitaire: prixU, total, tva_taux: tvaTaux,
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
        nom, categorie: guessCat(nom), quantite, unite,
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
        nom, categorie: guessCat(nom), quantite,
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
        nom, categorie: guessCat(nom), quantite,
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
  return blocks
    .map(parseOneFacture)
    .filter(f => f.lignes.length > 0 || f.numero_facture);
}
