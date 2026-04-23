import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
export const maxDuration = 120;  // parser déterministe, pas d'appel externe

// ── Types ──────────────────────────────────────────────────────────────────

interface ParsedLigne {
  nom:            string;
  categorie:      string;
  quantite:       number;
  unite:          string;
  prix_unitaire:  number;
  total:          number;
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
  date:           string | null;  // YYYY-MM-DD
  date_echeance:  string | null;
  lignes:         ParsedLigne[];
  montant_ht:     number | null;
  tva:            number | null;
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

/** Convertit "1 234,56" ou "1234.56" en number. */
function parseMontant(s: string | undefined | null): number | null {
  if (s == null) return null;
  const cleaned = String(s).replace(/\s+/g, "").replace(/\u00a0/g, "").replace(",", ".").replace(/[^-0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** JJ/MM/AAAA ou JJ-MM-AAAA → YYYY-MM-DD (tolère AA). */
function parseDateFr(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const yyyy = y.length === 2 ? (Number(y) > 50 ? "19" + y : "20" + y) : y;
  return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Classification par mots-clés sur la désignation (copie de lib/gestion-data). */
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

// ── Patterns regex globaux ─────────────────────────────────────────────────

/** Cherche un numéro de facture dans un bloc texte. */
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
  // Date de facture (priorité aux libellés explicites)
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
    // Fallback : première date trouvée
    const m = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
    if (m) date = parseDateFr(m[1]);
  }

  // Date d'échéance
  let dateEcheance: string | null = null;
  const meche = text.match(/(?:[eé]ch[eé]ance|date\s+d[''\s]?[eé]ch[eé]ance|[aà]\s+payer\s+avant)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
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
  // Cherche dans les zones "total HT", "total TVA", "total TTC" — supporte montants multi-mots
  const reHT  = /total\s+(?:net\s+)?h\.?t\.?\s*[:=.]?\s*([\d\s]+[,\.]\d{2})/i;
  const reTVA = /(?:total\s+)?t\.?v\.?a\.?(?:\s*\([\d.,]+\s*%\))?\s*[:=.]?\s*([\d\s]+[,\.]\d{2})/i;
  const reTTC = /(?:total\s+)?(?:net\s+[aà]\s+payer|t\.?t\.?c\.?|montant\s+ttc)\s*[:=.]?\s*([\d\s]+[,\.]\d{2})/i;
  return {
    ht:  parseMontant(text.match(reHT)?.[1]  ?? null),
    tva: parseMontant(text.match(reTVA)?.[1] ?? null),
    ttc: parseMontant(text.match(reTTC)?.[1] ?? null),
  };
}

/** Nom du fournisseur : en-tête de facture — heuristique :
 *  on prend la première ligne non vide du PDF qui ne contient PAS
 *  "FACTURE", "DATE", "CLIENT"... */
function matchFournisseurNom(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const blacklist = /FACTURE|CLIENT|DATE|N[°oº]|PAGE|TOTAL|SIRET|TVA/i;
  for (const l of lines.slice(0, 10)) {
    if (l.length >= 3 && l.length <= 80 && !blacklist.test(l) && /[A-Za-zÀ-ÿ]/.test(l)) {
      return l;
    }
  }
  return null;
}

// ── Parsing des lignes produits ────────────────────────────────────────────

/**
 * Format DPS Market et similaires :
 *   Code | Désignation | TVA% | Qté | Unité | Condit | PU HT | Prix cond. | (Remise) | Total HT
 * Exemple : "ART0564 FILET DE POULET FRAIS 5.5 2 COL 10 5.69 56,90 113,80"
 *
 * Capture souple : description riche, unité courte en majuscules, nombres à virgule/point.
 */
const DPS_LINE_RE = new RegExp(
  String.raw`^\s*` +
  String.raw`([A-Z]{1,6}\d{3,8})\s+` +                     // 1: code article
  String.raw`(.+?)\s+` +                                    // 2: désignation
  String.raw`(\d{1,2}(?:[.,]\d{1,2})?)\s+` +                // 3: TVA%
  String.raw`(\d+(?:[.,]\d+)?)\s+` +                        // 4: quantité
  String.raw`([A-Z]{1,5})\s+` +                             // 5: unité (COL, KG, PCE, L, UNI, CT, SAC…)
  String.raw`(\d+(?:[.,]\d+)?)\s+` +                        // 6: conditionnement (nb/lot)
  String.raw`([\d]+[.,]\d{1,4})\s+` +                       // 7: prix unitaire HT
  String.raw`([\d]+[.,]\d{2})\s+` +                         // 8: prix conditionné
  String.raw`(?:(\d+(?:[.,]\d+)?)\s+)?` +                   // 9?: remise éventuelle
  String.raw`([\d\s]*\d[.,]\d{2})\s*$`,                     // 10: total HT
);

/** Pattern générique de secours : ligne finissant par qté-unité-PU-total. */
const GEN_LINE_RE = new RegExp(
  String.raw`^\s*` +
  String.raw`(.+?)\s+` +                                    // 1: désignation
  String.raw`(\d+(?:[.,]\d+)?)\s*` +                        // 2: quantité
  String.raw`([A-Za-z]{1,5}|kg|pc|pce|u|l|g)\s+` +          // 3: unité
  String.raw`([\d]+[.,]\d{1,4})\s+` +                       // 4: prix unitaire
  String.raw`([\d\s]*\d[.,]\d{2})\s*$`,                     // 5: total
  "i",
);

function parseLignes(text: string): ParsedLigne[] {
  const lignes: ParsedLigne[] = [];
  const rawLines = text.split(/\r?\n/);

  for (const raw of rawLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 10) continue;

    // Skip lignes qui sont des en-têtes / totaux
    if (/^(total|sous[\s-]?total|tva|h\.?t\.?|ttc|net|acompte|remise|désignation|designation|quantit|unité|prix)/i.test(line)) continue;

    // Essai DPS d'abord
    let m = DPS_LINE_RE.exec(line);
    if (m) {
      const [, , designation, , qte, unite, , pu, , , totalHT] = m;
      const nom = designation.trim();
      if (nom.length < 3) continue;
      const quantite = parseMontant(qte) ?? 0;
      const prixU    = parseMontant(pu)  ?? 0;
      const total    = parseMontant(totalHT) ?? (quantite * prixU);
      lignes.push({
        nom,
        categorie:     guessCat(nom),
        quantite,
        unite:         unite.toLowerCase().trim() || "pce",
        prix_unitaire: prixU,
        total,
      });
      continue;
    }

    // Fallback générique
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
      });
    }
  }
  return lignes;
}

// ── Parser principal ───────────────────────────────────────────────────────

function parseOneFacture(text: string): ParsedFacture {
  const { date, dateEcheance } = matchDate(text);
  const totaux = matchTotaux(text);
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
    lignes:         parseLignes(text),
    montant_ht:  totaux.ht,
    tva:         totaux.tva,
    montant_ttc: totaux.ttc,
  };
}

/** Multi-factures : si le PDF contient plusieurs "FACTURE N°", on split et on parse chacune. */
function splitFactures(text: string): string[] {
  const markers: number[] = [];
  const re = /(?:^|\n)[^\n]*\bFACTURE\s*(?:N[°oº]|NO|NUM)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    markers.push(m.index);
  }
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
    engine: "pdf-parse + regex (zéro appel Claude)",
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

    // Cette route ne gère QUE les PDF texte. Les images ne sont pas supportées
    // sans moteur OCR ; on renvoie une erreur explicite.
    if (!mediaType.startsWith("application/pdf")) {
      return Response.json(
        { error: "Format non supporté. Seul le PDF (avec texte sélectionnable) est pris en charge. Pour une photo, utilisez un scan OCR puis uploadez le PDF résultant." },
        { status: 415 },
      );
    }

    // Magic bytes
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

    // Extraction texte brut via pdf-parse v2 (API classe)
    let text = "";
    let numPages = 0;
    try {
      const { PDFParse } = await import("pdf-parse");
      const t0 = Date.now();
      const bytes = new Uint8Array(Buffer.from(fileBase64, "base64"));
      const parser = new PDFParse({ data: bytes });
      const result = await parser.getText();
      text = result.text ?? "";
      numPages = result.total ?? result.pages?.length ?? 0;
      await parser.destroy();
      console.log(`[facture-import] pdf-parse ${numPages}p, ${text.length} chars, ${Date.now() - t0}ms`);
    } catch (e) {
      console.error("[facture-import] pdf-parse failed:", e);
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

    // Multi-factures si plusieurs "FACTURE N°" détectées
    const blocks = splitFactures(text);
    const factures = blocks.map(parseOneFacture).filter(f => f.lignes.length > 0 || f.numero_facture);

    if (factures.length === 0) {
      return Response.json(
        { error: "Aucune ligne de facture n'a pu être extraite automatiquement. Le format n'est peut-être pas reconnu — essayez l'éditeur manuel.",
          diagnostic: { pages: numPages, char_count: text.length, raw_sample: text.slice(0, 400) } },
        { status: 422 },
      );
    }

    // Pour compatibilité : si une seule facture, on renvoie `facture` (comme avant).
    // Sinon on renvoie aussi `factures` pour le traitement multi.
    const facture = factures[0];
    console.log(`[facture-import] ${factures.length} facture(s) détectée(s), ${facture.lignes.length} ligne(s) ligne 1`);

    return Response.json({
      ok: true,
      engine: "pdf-parse + regex",
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
