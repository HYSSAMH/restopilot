import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
export const maxDuration = 120;

// ── Types ──────────────────────────────────────────────────────────────────

interface ParsedLigne {
  nom:            string;
  categorie:      string;
  quantite:       number;
  unite:          string;
  prix_unitaire:  number;
  total:          number;
  tva_taux:       number | null;   // TVA en pourcentage (5.5, 10, 20)
}
interface TvaLigneRecap {
  taux:         number;
  base_ht:      number;
  montant_tva:  number;
  ttc:          number | null;
}
interface ParsedFacture {
  fournisseur: {
    nom:       string | null;
    siret:     string | null;
    adresse:   string | null;
    telephone: string | null;
    email:     string | null;
    tva_intra: string | null;
  };
  numero_facture: string | null;
  date:           string | null;
  date_echeance:  string | null;
  lignes:         ParsedLigne[];
  tva_recap:      TvaLigneRecap[];       // ← nouveau : table TVA du pied de facture
  montant_ht:     number | null;
  tva:            number | null;          // total TVA toutes bases
  montant_ttc:    number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function requireUser() {
  const cookieStore = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supa.auth.getUser();
  return user;
}

function parseMontant(s: string | undefined | null): number | null {
  if (s == null) return null;
  const cleaned = String(s).replace(/\s+/g, "").replace(/\u00a0/g, "").replace(",", ".").replace(/[^-0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseDateFr(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const yyyy = y.length === 2 ? (Number(y) > 50 ? "19" + y : "20" + y) : y;
  return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const CAT_KW: { cat: string; kws: string[] }[] = [
  { cat: "boucherie",       kws: ["boeuf","bœuf","veau","agneau","porc","poulet","volaille","charcuterie","jambon","saucisse","côte","cote","entrecote","entrecôte","filet","escalope","dinde","canard","rumsteck","bavette"] },
  { cat: "poissonnerie",    kws: ["poisson","saumon","cabillaud","thon","crevette","langoustine","huitre","huître","moule","bar","dorade","sole","lotte","crustace","crustacé","bulot","calamar"] },
  { cat: "fruits",          kws: ["pomme","poire","banane","orange","citron","fraise","framboise","raisin","cerise","peche","pêche","abricot","ananas","mangue","kiwi","melon","pasteque","pastèque"] },
  { cat: "legumes",         kws: ["tomate","courgette","aubergine","poivron","oignon","ail","carotte","poireau","haricot","champignon","epinard","épinard","brocoli","chou","concombre","radis","betterave"] },
  { cat: "pommes_de_terre", kws: ["pomme de terre","patate","grenaille","charlotte","agria","bintje"] },
  { cat: "salades",         kws: ["salade","laitue","roquette","mesclun","scarole","mache","mâche","frisee","frisée","endive"] },
  { cat: "herbes",          kws: ["persil","basilic","menthe","ciboulette","coriandre","thym","romarin","estragon","aneth","sauge","origan"] },
  { cat: "cremerie",        kws: ["lait","beurre","creme","crème","fromage","yaourt","oeuf","œuf","camembert","comte","comté","mozzarella","parmesan","gruyere"] },
];
function guessCat(nom: string): string {
  const n = nom.toLowerCase();
  for (const { cat, kws } of CAT_KW) {
    if (kws.some(k => n.includes(k))) return cat;
  }
  return "epicerie";
}

/** Extraction texte PDF via pdf2json (pure Node, pas de dépendance browser). */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const mod = await import("pdf2json");
  const PDFParser = (mod.default ?? mod) as unknown as new (ctx: null, needRawText?: boolean) => {
    on(ev: string, cb: (data: unknown) => void): void;
    parseBuffer(buf: Buffer): void;
    getRawTextContent(): string;
  };
  const parser = new PDFParser(null, true);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("pdf2json timeout (60s)")), 60_000);
    parser.on("pdfParser_dataError", (errData) => {
      clearTimeout(timer);
      const e = errData as { parserError?: Error };
      reject(e.parserError ?? new Error("pdf2json error"));
    });
    parser.on("pdfParser_dataReady", () => {
      clearTimeout(timer);
      const text = parser.getRawTextContent();
      const pageMatches = text.match(/Page \(\d+\) Break/g);
      const pages = pageMatches ? pageMatches.length : 1;
      resolve({ text, pages });
    });
    parser.parseBuffer(buffer);
  });
}

// ── Patterns d'en-tête / footer ────────────────────────────────────────────

function matchNumero(text: string): string | null {
  const patterns = [
    /(?:FACTURE|FACT|FAC)\s*(?:N[°oº]|NO|NUM[ÉE]RO)?\s*[:.]?\s*([A-Z]{0,4}[\-_ ]?\d{3,}[\-_ ]?\d*[A-Z0-9\-]*)/i,
    /\bN[°oº]\s*[:.]?\s*(F[A-Z0-9\-]{3,20})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, "");
  }
  return null;
}

function matchDate(text: string): { date: string | null; dateEcheance: string | null } {
  const labels = [
    /(?:date\s+de\s+(?:la\s+)?facture|date\s+facture|date\s+(?:d[''\s]?)?[eé]mission)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:emise?\s+le|en\s+date\s+du|facture\s+du)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];
  let date: string | null = null;
  for (const p of labels) {
    const m = text.match(p);
    if (m) { date = parseDateFr(m[1]); if (date) break; }
  }
  if (!date) {
    const m = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
    if (m) date = parseDateFr(m[1]);
  }
  let dateEcheance: string | null = null;
  const meche = text.match(/(?:[eé]ch[eé]ance|[aà]\s+payer\s+avant)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (meche) dateEcheance = parseDateFr(meche[1]);
  return { date, dateEcheance };
}

function matchSiret(text: string): string | null {
  const m = text.match(/\bSIRET\s*[:.]?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/i)
         || text.match(/\b(\d{14})\b/);
  return m ? m[1].replace(/\s/g, "") : null;
}
function matchTvaIntra(text: string): string | null {
  const m = text.match(/\b(FR\s?\d{2}\s?\d{9})\b/i);
  return m ? m[1].replace(/\s/g, "").toUpperCase() : null;
}
function matchTelephone(text: string): string | null {
  const m = text.match(/(?:T[éeé]l(?:[ée]phone)?|☎)\s*[:.]?\s*((?:\+33\s?|0)[1-9](?:[.\s\-]?\d{2}){4})/i)
         || text.match(/\b((?:\+33\s?|0)[1-9](?:[.\s\-]?\d{2}){4})\b/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}
function matchEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}
function matchTotaux(text: string): { ht: number | null; tva: number | null; ttc: number | null } {
  const reHT  = /total\s+(?:net\s+)?h\.?t\.?\s*[:=.]?\s*([\d\s]+[,\.]\d{2})/i;
  const reTVA = /total\s+t\.?v\.?a\.?(?:\s*\([\d.,]+\s*%\))?\s*[:=.]?\s*([\d\s]+[,\.]\d{2})/i;
  const reTTC = /(?:total\s+)?(?:net\s+[aà]\s+payer|t\.?t\.?c\.?|montant\s+ttc)\s*[:=.]?\s*([\d\s]+[,\.]\d{2})/i;
  return {
    ht:  parseMontant(text.match(reHT)?.[1]  ?? null),
    tva: parseMontant(text.match(reTVA)?.[1] ?? null),
    ttc: parseMontant(text.match(reTTC)?.[1] ?? null),
  };
}

function matchFournisseurNom(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const blacklist = /FACTURE|CLIENT|DATE|N[°oº]|PAGE|TOTAL|SIRET|TVA|---/i;
  for (const l of lines.slice(0, 12)) {
    if (l.length >= 3 && l.length <= 80 && !blacklist.test(l) && /[A-Za-zÀ-ÿ]/.test(l)) {
      return l;
    }
  }
  return null;
}

/** Table récapitulative TVA en pied de facture.
 *
 *  Lignes types :
 *    TVA 5,5%   113,80   6,26   120,06
 *    20 %       13,50    2,70   16,20
 *    5,5%   113.80   6.26
 *
 *  On cherche des motifs `taux %` suivis de 2 ou 3 montants sur la même ligne.
 */
function matchTvaRecap(text: string): TvaLigneRecap[] {
  const out: TvaLigneRecap[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim());
  // Sauter l'en-tête « TVA Base HT Montant TTC » si présente
  for (const raw of lines) {
    if (!raw) continue;
    // On n'accepte que les lignes courtes typiques d'un récap (longueur < 60)
    if (raw.length > 80) continue;

    // 3 ou 4 montants : base + montant_tva + (ttc?) après le taux
    const m = raw.match(
      /(?:TVA\s+)?(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s+([\d\s]+[.,]\d{2})\s+([\d\s]+[.,]\d{2})(?:\s+([\d\s]+[.,]\d{2}))?/i,
    );
    if (!m) continue;
    const taux      = parseMontant(m[1]);
    const base_ht   = parseMontant(m[2]);
    const montant_tva = parseMontant(m[3]);
    const ttc       = m[4] ? parseMontant(m[4]) : null;
    if (taux == null || base_ht == null || montant_tva == null) continue;
    // Taux plausibles uniquement (2.1, 5.5, 10, 20)
    if (taux < 0 || taux > 30) continue;
    out.push({
      taux,
      base_ht,
      montant_tva,
      ttc: ttc ?? Math.round((base_ht + montant_tva) * 100) / 100,
    });
  }
  // Déduplique par taux (si plusieurs lignes identiques)
  const seen = new Map<number, TvaLigneRecap>();
  for (const l of out) {
    if (!seen.has(l.taux) || l.base_ht > (seen.get(l.taux)?.base_ht ?? 0)) seen.set(l.taux, l);
  }
  return Array.from(seen.values()).sort((a, b) => a.taux - b.taux);
}

// ── Parsing des lignes produits ────────────────────────────────────────────

/**
 * Format DPS Market :
 *   Code | Désignation | TVA% | Qté | Unité | Condit | PU HT | Prix cond. | (Remise) | Total HT
 * ex : "ART0564 FILET DE POULET FRAIS 5.5 2 COL 10 5.69 56,90 113,80"
 */
const DPS_LINE_RE = new RegExp(
  String.raw`^\s*` +
  String.raw`([A-Z]{1,6}\d{3,8})\s+` +
  String.raw`(.+?)\s+` +
  String.raw`(\d{1,2}(?:[.,]\d{1,2})?)\s+` +          // 3: TVA%
  String.raw`(\d+(?:[.,]\d+)?)\s+` +
  String.raw`([A-Z]{1,5})\s+` +
  String.raw`(\d+(?:[.,]\d+)?)\s+` +
  String.raw`([\d]+[.,]\d{1,4})\s+` +
  String.raw`([\d]+[.,]\d{2})\s+` +
  String.raw`(?:(\d+(?:[.,]\d+)?)\s+)?` +
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

function parseLignes(text: string): ParsedLigne[] {
  const lignes: ParsedLigne[] = [];
  const rawLines = text.split(/\r?\n/);
  for (const raw of rawLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 10) continue;
    if (/^(total|sous[\s-]?total|tva|h\.?t\.?|ttc|net|acompte|remise|désignation|designation|quantit|unité|prix)/i.test(line)) continue;

    let m = DPS_LINE_RE.exec(line);
    if (m) {
      const [, , designation, tva, qte, unite, , pu, , , totalHT] = m;
      const nom = designation.trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(qte) ?? 0;
      const prixU    = parseMontant(pu)  ?? 0;
      const total    = parseMontant(totalHT) ?? (quantite * prixU);
      const tvaPct   = parseMontant(tva);
      lignes.push({
        nom,
        categorie:     guessCat(nom),
        quantite,
        unite:         unite.toLowerCase().trim() || "pce",
        prix_unitaire: prixU,
        total,
        tva_taux:      tvaPct != null && tvaPct >= 0 && tvaPct <= 30 ? tvaPct : null,
      });
      continue;
    }

    m = GEN_LINE_RE.exec(line);
    if (m) {
      const [, designation, qte, unite, pu, totalHT] = m;
      const nom = designation.trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(qte) ?? 0;
      const prixU    = parseMontant(pu)  ?? 0;
      const total    = parseMontant(totalHT) ?? (quantite * prixU);
      if (total <= 0 || quantite <= 0 || prixU <= 0) continue;
      lignes.push({
        nom,
        categorie:     guessCat(nom),
        quantite,
        unite:         unite.toLowerCase().trim() || "pce",
        prix_unitaire: prixU,
        total,
        tva_taux:      null,   // pas de TVA captée dans le pattern générique
      });
    }
  }
  return lignes;
}

// ── Parser principal ───────────────────────────────────────────────────────

function parseOneFacture(text: string): ParsedFacture {
  const { date, dateEcheance } = matchDate(text);
  const totaux   = matchTotaux(text);
  const tvaRecap = matchTvaRecap(text);
  const lignes   = parseLignes(text);

  // Si pas de TVA par ligne (pattern générique) mais un unique taux trouvé
  // dans le récap, on le propage aux lignes vides.
  if (tvaRecap.length === 1) {
    const t = tvaRecap[0].taux;
    for (const l of lignes) if (l.tva_taux == null) l.tva_taux = t;
  }

  return {
    fournisseur: {
      nom:       matchFournisseurNom(text),
      siret:     matchSiret(text),
      adresse:   null,
      telephone: matchTelephone(text),
      email:     matchEmail(text),
      tva_intra: matchTvaIntra(text),
    },
    numero_facture: matchNumero(text),
    date,
    date_echeance:  dateEcheance,
    lignes,
    tva_recap:      tvaRecap,
    montant_ht:  totaux.ht,
    tva:         totaux.tva ?? (tvaRecap.length > 0 ? tvaRecap.reduce((s, l) => s + l.montant_tva, 0) : null),
    montant_ttc: totaux.ttc,
  };
}

/** Multi-factures : si plusieurs "FACTURE N°" dans le même PDF, on split. */
function splitFactures(text: string): string[] {
  const markers: number[] = [];
  const re = /(?:^|\n)[^\n]*\bFACTURE\s*(?:N[°oº]|NO|NUM)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) markers.push(m.index);
  if (markers.length <= 1) return [text];
  const blocks: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i];
    const end   = i + 1 < markers.length ? markers[i + 1] : text.length;
    blocks.push(text.slice(start, end));
  }
  return blocks;
}

// ── GET diagnostic ────────────────────────────────────────────────────────

export async function GET() {
  return Response.json({
    ok: true,
    engine: "pdf2json + regex (zéro appel Claude, pur Node.js)",
    runtime: "nodejs",
    max_duration_s: 120,
  });
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    let fileBase64: string;
    let mediaType: string;
    try {
      const body = await req.json();
      fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : "";
      mediaType  = typeof body?.mediaType  === "string" ? body.mediaType  : "application/pdf";
      if (!fileBase64) return Response.json({ error: "fileBase64 manquant." }, { status: 400 });
    } catch (e) {
      return Response.json(
        { error: "Corps invalide : " + (e instanceof Error ? e.message : String(e)) },
        { status: 400 },
      );
    }

    if (!mediaType.startsWith("application/pdf")) {
      return Response.json(
        { error: "Format non supporté. Seul le PDF (texte sélectionnable) est pris en charge." },
        { status: 415 },
      );
    }

    const head = Buffer.from(fileBase64.slice(0, 12), "base64").subarray(0, 4).toString("ascii");
    if (head !== "%PDF") {
      return Response.json({ error: "Fichier invalide : ce n'est pas un PDF." }, { status: 415 });
    }

    const approxBytes = Math.ceil(fileBase64.length * 0.75);
    if (approxBytes > 25 * 1024 * 1024) {
      return Response.json(
        { error: `PDF trop volumineux (${(approxBytes / 1024 / 1024).toFixed(1)} Mo). Max 25 Mo.` },
        { status: 413 },
      );
    }

    // Extraction texte
    let text = "";
    let numPages = 0;
    try {
      const t0 = Date.now();
      const out = await extractPdfText(Buffer.from(fileBase64, "base64"));
      text = out.text;
      numPages = out.pages;
      console.log(`[facture-import] pdf2json ${numPages}p, ${text.length} chars, ${Date.now() - t0}ms`);
    } catch (e) {
      console.error("[facture-import] pdf2json failed:", e);
      return Response.json(
        { error: "Extraction PDF échouée : " + (e instanceof Error ? e.message : String(e)) },
        { status: 500 },
      );
    }

    if (text.trim().length < 100) {
      return Response.json(
        {
          error: "Ce PDF est scanné (sans texte sélectionnable). Veuillez importer une photo lisible — ou passer le PDF dans un outil OCR avant import.",
          diagnostic: { pages: numPages, char_count: text.length },
        },
        { status: 422 },
      );
    }

    const blocks = splitFactures(text);
    const factures = blocks.map(parseOneFacture).filter(f => f.lignes.length > 0 || f.numero_facture);

    if (factures.length === 0) {
      return Response.json(
        { error: "Aucune ligne de facture n'a pu être extraite automatiquement. Le format n'est peut-être pas reconnu — essayez l'éditeur manuel.",
          diagnostic: { pages: numPages, char_count: text.length, raw_sample: text.slice(0, 400) } },
        { status: 422 },
      );
    }

    const facture = factures[0];
    console.log(
      `[facture-import] ${factures.length} facture(s), ${facture.lignes.length} ligne(s), ` +
      `${facture.tva_recap.length} taux TVA`,
    );

    return Response.json({
      ok: true,
      engine: "pdf2json + regex",
      facture,
      factures: factures.length > 1 ? factures : undefined,
      diagnostic: {
        pages: numPages,
        char_count: text.length,
        factures_count: factures.length,
      },
    });
  } catch (e) {
    console.error("[facture-import] exception:", e);
    return Response.json(
      { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
