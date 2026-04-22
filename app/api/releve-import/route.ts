import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime     = "nodejs";
export const maxDuration = 300;

const MODEL_ID = "claude-sonnet-4-5";
const MAX_TOKENS_PER_PAGE = 2000;

// ── Types ────────────────────────────────────────────────────────────────

type Categorie =
  | "remise_cb" | "commission_cb" | "prelevement" | "salaire" | "virement"
  | "paiement_cb" | "charges_sociales" | "prevoyance" | "cheque"
  | "frais_bancaires" | "autre";

interface ParsedLigne {
  date:            string | null;
  libelle:         string;
  montant_debit:   number;
  montant_credit:  number;
  solde_courant:   number | null;
  categorie:       Categorie;
}
interface ParsedReleve {
  periode_debut: string | null;
  periode_fin:   string | null;
  solde_debut:   number | null;
  solde_fin:     number | null;
  lignes:        ParsedLigne[];
}

type DocBlock = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};
type MsgContent = Anthropic.TextBlockParam | DocBlock;

// ── Prompt court page par page ──────────────────────────────────────────
// Très concis et strict : max_tokens 2000, renvoie un tableau JSON brut.
// Le format demandé à Claude est minimal (date JJ/MM/AAAA, debit, credit),
// on enrichit ensuite côté serveur (normalisation date + catégorisation).
function pagePrompt(page: number, total: number): string {
  return `Extrais les lignes du tableau bancaire de la page ${page}/${total}. JSON uniquement, aucun texte. Format: [{"date":"JJ/MM/AAAA","libelle":"...","debit":0,"credit":0}]. Les montants sont toujours positifs (utilise debit OU credit). Ignore entêtes, pieds de page, totaux intermédiaires, numéros de page. Si la page ne contient pas de tableau bancaire (page de garde, conditions, etc.), retourne [].`;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES: ReadonlySet<Categorie> = new Set([
  "remise_cb","commission_cb","prelevement","salaire","virement",
  "paiement_cb","charges_sociales","prevoyance","cheque","frais_bancaires","autre",
]);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseDateFr(s: string | null | undefined): string | null {
  if (!s) return null;
  const str = String(s).trim();
  // JJ/MM/AAAA → YYYY-MM-DD
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? (Number(y) > 50 ? "19" + y : "20" + y) : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? m2[0] : null;
}

function categorize(libelle: string): Categorie {
  const s = libelle.toUpperCase();
  if (/REMCB|REMISE\s*CB|REM\.\s*CB/.test(s))     return "remise_cb";
  if (/COMCB|COMMISSION\s*CB/.test(s))              return "commission_cb";
  if (/URSSAF/.test(s))                              return "charges_sociales";
  if (/KLESIA|AG2R|MALAKOFF|MUTUEL/.test(s))        return "prevoyance";
  if (/PRLV|PRELEVEMENT|PRELV/.test(s))              return "prelevement";
  if (/\bVIR\b.*(SAL|PAYE|PAYROLL|SALAIRE)/.test(s)) return "salaire";
  if (/\bVIR\b|VIREMENT/.test(s))                    return "virement";
  if (/PAIEMENT\s*CB|ACHAT\s*CB|\bCB\s*\*/.test(s)) return "paiement_cb";
  if (/CHEQUE|\bCHQ\b/.test(s))                      return "cheque";
  if (/FRAIS|COTIS\s*CARTE|AGIOS/.test(s))          return "frais_bancaires";
  return "autre";
}

/** Parse la réponse JSON d'UNE page (tableau court). */
function parsePageResponse(text: string): ParsedLigne[] {
  if (!text) return [];
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const raw = JSON.parse(match[0]);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
      .map(l => {
        const libelle = String(l.libelle ?? "").trim().replace(/\s+/g, " ");
        const date    = parseDateFr(l.date as string | null);
        const debit   = num(l.debit  ?? l.montant_debit)  ?? 0;
        const credit  = num(l.credit ?? l.montant_credit) ?? 0;
        const fallbackCat = typeof l.categorie === "string" ? l.categorie as Categorie : undefined;
        const cat = fallbackCat && VALID_CATEGORIES.has(fallbackCat) ? fallbackCat : categorize(libelle);
        return {
          date,
          libelle,
          montant_debit:  debit,
          montant_credit: credit,
          solde_courant:  null,
          categorie:      cat,
        } as ParsedLigne;
      })
      .filter(l => l.libelle.length > 0 && (l.montant_debit > 0 || l.montant_credit > 0));
  } catch (e) {
    console.error("[releve-import] parse page JSON error:", e);
    return [];
  }
}

// ── Appel Claude par page (en parallèle via Promise.all) ─────────────────

async function extractPage(
  anthropic: Anthropic,
  pdfBase64: string,
  page: number,
  total: number,
): Promise<{ page: number; lignes: ParsedLigne[]; ms: number; empty: boolean; error?: string }> {
  const t0 = Date.now();
  try {
    const content: MsgContent[] = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      { type: "text", text: pagePrompt(page, total) },
    ];
    const msg = await (anthropic.messages.create as (
      body: Omit<Anthropic.MessageCreateParamsNonStreaming, "messages"> & {
        messages: { role: "user"; content: MsgContent[] }[];
      },
      opts?: Anthropic.RequestOptions,
    ) => Promise<Anthropic.Message>)(
      { model: MODEL_ID, max_tokens: MAX_TOKENS_PER_PAGE, messages: [{ role: "user", content }] },
      { headers: { "anthropic-beta": "pdfs-2024-09-25" } },
    );
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const ms = Date.now() - t0;

    // Page sans tableau bancaire → Claude renvoie [] ou chaîne vide
    const trimmed = text.trim();
    if (trimmed === "[]" || trimmed.length === 0) {
      console.log(`[releve-import] page ${page}/${total} — vide (${ms}ms)`);
      return { page, lignes: [], ms, empty: true };
    }

    const lignes = parsePageResponse(text);
    console.log(`[releve-import] page ${page}/${total} — ${ms}ms, ${text.length} chars → ${lignes.length} lignes`);
    return { page, lignes, ms, empty: lignes.length === 0 };
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[releve-import] page ${page}/${total} ❌ ${ms}ms — ${msg}`);
    return { page, lignes: [], ms, empty: true, error: msg };
  }
}

// ── Agrège les résultats pages → ParsedReleve ────────────────────────────

function aggregate(pages: { page: number; lignes: ParsedLigne[] }[]): ParsedReleve {
  // Trie par numéro de page pour préserver l'ordre chronologique
  const lignes = pages
    .sort((a, b) => a.page - b.page)
    .flatMap(p => p.lignes);

  // Déduplication simple (date + libelle + montant)
  const seen = new Set<string>();
  const deduped = lignes.filter(l => {
    const key = `${l.date ?? ""}|${l.libelle}|${l.montant_debit}|${l.montant_credit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dates = deduped.map(l => l.date).filter((d): d is string => !!d).sort();
  return {
    periode_debut: dates[0]             ?? null,
    periode_fin:   dates.at(-1)         ?? null,
    solde_debut:   null,  // non extrait — le client peut le saisir manuellement
    solde_fin:     null,
    lignes:        deduped,
  };
}

// ── Détection page count depuis le base64 (fallback serveur) ─────────────

function detectPageCount(base64: string): number {
  try {
    const binary = Buffer.from(base64, "base64").toString("binary");
    let max = 0;
    const re = /\/Count\s+(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(binary)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max && n < 9999) max = n;
    }
    return max > 0 ? max : 1;
  } catch {
    return 1;
  }
}

// ── GET diagnostic ───────────────────────────────────────────────────────

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return Response.json({
    ok:             Boolean(apiKey) && apiKey !== "your_anthropic_api_key_here",
    model_id:       MODEL_ID,
    runtime:        "nodejs",
    max_duration_s: 300,
    strategy:       "per-page parallel",
    max_tokens_per_page: MAX_TOKENS_PER_PAGE,
  });
}

// ── POST ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const tStart = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_anthropic_api_key_here") {
      return Response.json(
        { error: "ANTHROPIC_API_KEY manquante. Ajoutez-la dans les variables d'environnement Netlify (scope server)." },
        { status: 500 },
      );
    }

    // 1. Body
    let fileBase64: string;
    let pageCountClient: number | undefined;
    try {
      const body = await req.json();
      fileBase64      = typeof body?.fileBase64 === "string" ? body.fileBase64 : "";
      pageCountClient = typeof body?.pageCount  === "number" ? body.pageCount  : undefined;
      if (!fileBase64) {
        return Response.json({ error: "Paramètre fileBase64 manquant." }, { status: 400 });
      }
    } catch (e) {
      return Response.json(
        { error: "Corps de requête invalide : " + (e instanceof Error ? e.message : String(e)) },
        { status: 400 },
      );
    }

    // 2. Taille
    const approxBytes = Math.ceil(fileBase64.length * 0.75);
    if (approxBytes > 25 * 1024 * 1024) {
      return Response.json(
        { error: `Fichier trop volumineux (${(approxBytes / 1024 / 1024).toFixed(1)} Mo). Max 25 Mo.` },
        { status: 413 },
      );
    }

    // 3. Nombre de pages (client prioritaire, sinon détection /Count)
    const detected = detectPageCount(fileBase64);
    const pageCount = Math.min(Math.max(1, pageCountClient ?? detected), 30);
    console.log(`[releve-import] ▶ démarrage — ${pageCount} page(s), ${(approxBytes/1024).toFixed(0)} KB`);

    // 4. Extraction parallèle
    const anthropic = new Anthropic({ apiKey });
    const pagePromises = Array.from({ length: pageCount }, (_, i) =>
      extractPage(anthropic, fileBase64, i + 1, pageCount),
    );

    const results = await Promise.all(pagePromises);

    const totalMs = Date.now() - tStart;
    const errors  = results.filter(r => r.error).length;
    const empties = results.filter(r => r.empty).length;
    const ligneCount = results.reduce((s, r) => s + r.lignes.length, 0);
    console.log(
      `[releve-import] ■ fini — ${totalMs}ms total | pages: ${pageCount} (${empties} vides, ${errors} erreurs) | ${ligneCount} lignes`,
    );
    console.log("[releve-import] ⏱ détail par page :", results.map(r => `p${r.page}=${r.ms}ms(${r.lignes.length}l${r.error ? `,err:${r.error.slice(0,60)}` : ""})`).join(" · "));

    if (ligneCount === 0) {
      return Response.json(
        { error: errors > 0
            ? `Extraction échouée sur toutes les pages (${errors} erreurs). Vérifiez que le PDF est un relevé bancaire lisible.`
            : "Aucune ligne détectée dans le PDF. Vérifiez qu'il s'agit bien d'un relevé de compte.",
          diagnostic: { pages: pageCount, empty: empties, errors, duration_ms: totalMs },
        },
        { status: 422 },
      );
    }

    const releve = aggregate(results);
    return Response.json({
      ok: true,
      releve,
      diagnostic: {
        pages: pageCount,
        empty_pages: empties,
        failed_pages: errors,
        duration_ms: totalMs,
        per_page_ms: results.map(r => ({ page: r.page, ms: r.ms, lines: r.lignes.length })),
      },
    });
  } catch (e) {
    console.error("[releve-import] exception non gérée :", e);
    return Response.json(
      { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
