import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime     = "nodejs";
export const maxDuration = 60;

const MODEL_ID = "claude-sonnet-4-5";

// ── Types ────────────────────────────────────────────────────────────────

type Categorie =
  | "remise_cb"          // REMCB — encaissement CB
  | "commission_cb"      // COMCB — commissions CB
  | "prelevement"        // PRLV SEPA — charges fixes
  | "salaire"            // VIR SALAIRE — masse salariale
  | "virement"           // VIR — autre virement
  | "paiement_cb"        // PAIEMENT CB — dépense CB
  | "charges_sociales"   // URSSAF
  | "prevoyance"         // KLESIA / AG2R / MALAKOFF / mutuelle
  | "cheque"             // CHEQUE
  | "frais_bancaires"    // FRAIS, COTIS CARTE…
  | "autre";

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

// ── Prompt ───────────────────────────────────────────────────────────────

const PROMPT = `Tu analyses un RELEVÉ DE COMPTE BANCAIRE français (typiquement Crédit Mutuel, BNP, Société Générale…) et tu extrais TOUTES les lignes d'opération en JSON strict.

FORMAT TYPIQUE CRÉDIT MUTUEL — 5 colonnes :
  Date | Date valeur | Opération | Débit EUROS | Crédit EUROS
Le solde courant figure en haut (solde initial) et en bas (solde final). Un solde progressif peut apparaître après chaque ligne : capture-le si visible.

RÈGLES STRICTES :
- Retourne TOUTES les lignes visibles du relevé, même nombreuses (> 100), sans troncature.
- Format date : YYYY-MM-DD (convertis depuis JJ/MM/AAAA ou JJ/MM).
- Les montants sont TOUJOURS positifs dans le JSON. Une ligne est :
    • un débit   → montant_debit  = montant, montant_credit = 0
    • un crédit  → montant_credit = montant, montant_debit  = 0
- "solde_courant" = solde après l'opération si visible ligne par ligne, sinon null.
- "libelle" = le texte brut de la colonne Opération (peut tenir sur plusieurs lignes dans le PDF — concatène-les en une seule chaîne).
- Si un champ est illisible : date et solde_courant → null ; libelle obligatoire, ne jamais inventer.
- Pas de symbole € dans les nombres, pas de séparateur de milliers.

CATÉGORISATION automatique de chaque ligne (champ "categorie"). Inspecte le libellé :
  - Contient "REMCB" ou "REMISE CB" ou "REM CB"      → "remise_cb"
  - Contient "COMCB" ou "COMMISSION CB"              → "commission_cb"
  - Contient "PRLV" ou "PRELEVEMENT" ou "PRELV"      → "prelevement"
  - Contient "VIR" + "SAL" (salaire, paye, payroll)  → "salaire"
  - Contient "VIR" ou "VIREMENT" (autre)             → "virement"
  - Contient "PAIEMENT CB", "ACHAT CB", "CB *"       → "paiement_cb"
  - Contient "URSSAF"                                → "charges_sociales"
  - Contient "KLESIA", "AG2R", "MALAKOFF", "MUTUEL"  → "prevoyance"
  - Contient "CHEQUE" ou "CHQ"                       → "cheque"
  - Contient "FRAIS", "COTIS CARTE", "AGIOS"         → "frais_bancaires"
  - Sinon                                            → "autre"

Retourne UNIQUEMENT le JSON brut (pas de markdown, pas de texte avant/après, pas de commentaire) :
{
  "periode_debut": "YYYY-MM-DD",
  "periode_fin":   "YYYY-MM-DD",
  "solde_debut":   1234.56,
  "solde_fin":     2345.67,
  "lignes": [
    {
      "date":           "2026-04-01",
      "libelle":        "VIR SEPA EDF CLIENTS 4200123",
      "montant_debit":  120.50,
      "montant_credit": 0,
      "solde_courant":  3400.21,
      "categorie":      "prelevement"
    }
  ]
}`;

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

/** Re-catégorise côté serveur (filet de sécurité au cas où Claude se trompe). */
function categorize(libelle: string, fallback: unknown): Categorie {
  const s = libelle.toUpperCase();
  if (/REMCB|REMISE\s*CB|REM\.\s*CB/.test(s)) return "remise_cb";
  if (/COMCB|COMMISSION\s*CB/.test(s))         return "commission_cb";
  if (/URSSAF/.test(s))                         return "charges_sociales";
  if (/KLESIA|AG2R|MALAKOFF|MUTUEL/.test(s))   return "prevoyance";
  if (/PRLV|PRELEVEMENT|PRELV/.test(s))         return "prelevement";
  if (/\bVIR\b.*(SAL|PAYE|PAYROLL|SALAIRE)/.test(s)) return "salaire";
  if (/\bVIR\b|VIREMENT/.test(s))               return "virement";
  if (/PAIEMENT\s*CB|ACHAT\s*CB|\bCB\s*\*/.test(s)) return "paiement_cb";
  if (/CHEQUE|\bCHQ\b/.test(s))                 return "cheque";
  if (/FRAIS|COTIS\s*CARTE|AGIOS/.test(s))     return "frais_bancaires";
  const f = typeof fallback === "string" ? fallback as Categorie : "autre";
  return VALID_CATEGORIES.has(f) ? f : "autre";
}

function parseReleve(text: string): ParsedReleve | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Partial<ParsedReleve>;
    const lignesRaw = Array.isArray(raw.lignes) ? raw.lignes : [];
    return {
      periode_debut: raw.periode_debut ? String(raw.periode_debut) : null,
      periode_fin:   raw.periode_fin   ? String(raw.periode_fin)   : null,
      solde_debut:   num(raw.solde_debut),
      solde_fin:     num(raw.solde_fin),
      lignes: lignesRaw.map((l: Partial<ParsedLigne> & { debit?: number; credit?: number; solde?: number }) => {
        const libelle = l.libelle ? String(l.libelle).trim().replace(/\s+/g, " ") : "";
        const debitIn  = (l.montant_debit  ?? l.debit)  as unknown;
        const creditIn = (l.montant_credit ?? l.credit) as unknown;
        const soldeIn  = (l.solde_courant  ?? l.solde)  as unknown;
        return {
          date:            l.date ? String(l.date) : null,
          libelle,
          montant_debit:   num(debitIn)  ?? 0,
          montant_credit:  num(creditIn) ?? 0,
          solde_courant:   num(soldeIn),
          categorie:       categorize(libelle, l.categorie),
        };
      }).filter(l => l.libelle.length > 0),
    };
  } catch (e) {
    console.error("[releve-import] parse JSON error:", e);
    return null;
  }
}

// ── GET diagnostic ───────────────────────────────────────────────────────

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return Response.json({
    ok:             Boolean(apiKey) && apiKey !== "your_anthropic_api_key_here",
    model_id:       MODEL_ID,
    runtime:        "nodejs",
    max_duration_s: 60,
  });
}

// ── POST ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Garde-fou GLOBAL : toute erreur (y compris parse body) produit du JSON,
  // jamais du HTML. Sans ce wrapper, Netlify peut renvoyer une page d'erreur
  // et le client reçoit "Unexpected token '<'".
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_anthropic_api_key_here") {
      return Response.json(
        { error: "ANTHROPIC_API_KEY manquante. Ajoutez-la dans les variables d'environnement Netlify (scope server)." },
        { status: 500 },
      );
    }

    // 1. Lecture du body
    let fileBase64: string;
    try {
      const body = await req.json();
      fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : "";
      if (!fileBase64) {
        return Response.json({ error: "Paramètre fileBase64 manquant dans le corps de la requête." }, { status: 400 });
      }
    } catch (e) {
      return Response.json(
        { error: "Corps de requête invalide : " + (e instanceof Error ? e.message : String(e)) },
        { status: 400 },
      );
    }

    // 2. Vérif taille raisonnable (base64 d'un PDF de ~20 Mo ≈ 27 Mo de string)
    const approxBytes = Math.ceil(fileBase64.length * 0.75);
    console.log(`[releve-import] POST — base64 len=${fileBase64.length}, ≈ ${(approxBytes / 1024 / 1024).toFixed(1)} Mo`);
    if (approxBytes > 25 * 1024 * 1024) {
      return Response.json(
        { error: `Fichier trop volumineux (${(approxBytes / 1024 / 1024).toFixed(1)} Mo). Maximum accepté : 25 Mo.` },
        { status: 413 },
      );
    }

    // 3. Appel Claude
    const anthropic = new Anthropic({ apiKey });
    const content: MsgContent[] = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } },
      { type: "text", text: PROMPT },
    ];

    let text = "";
    try {
      const t0 = Date.now();
      const msg = await (anthropic.messages.create as (
        body: Omit<Anthropic.MessageCreateParamsNonStreaming, "messages"> & {
          messages: { role: "user"; content: MsgContent[] }[];
        },
        opts?: Anthropic.RequestOptions,
      ) => Promise<Anthropic.Message>)(
        { model: MODEL_ID, max_tokens: 8192, messages: [{ role: "user", content }] },
        { headers: { "anthropic-beta": "pdfs-2024-09-25" } },
      );
      text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      console.log(`[releve-import] ← Claude ${Date.now() - t0}ms, ${text.length} chars`);
    } catch (e) {
      console.error("[releve-import] Anthropic error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      const status = /401|403|unauthorized|invalid.*api.*key/i.test(msg) ? 401
                   : /429|rate.?limit/i.test(msg)                         ? 429
                   : /timeout|ETIMEDOUT/i.test(msg)                       ? 504
                   :                                                         500;
      return Response.json({ error: "Appel Claude échoué : " + msg }, { status });
    }

    if (!text) {
      return Response.json({ error: "Claude a retourné une réponse vide." }, { status: 500 });
    }

    // 4. Parse JSON retourné
    const parsed = parseReleve(text);
    if (!parsed) {
      console.warn("[releve-import] JSON non parsable, extrait :", text.slice(0, 300));
      return Response.json(
        { error: "Réponse Claude non parsable en JSON.", raw: text.slice(0, 500) },
        { status: 502 },
      );
    }

    if (parsed.lignes.length === 0) {
      return Response.json(
        { error: "Aucune ligne détectée dans le PDF. Vérifiez qu'il s'agit bien d'un relevé de compte lisible." },
        { status: 422 },
      );
    }

    return Response.json({ ok: true, releve: parsed });
  } catch (e) {
    // Filet de sécurité ultime : ne jamais laisser passer une exception non gérée
    console.error("[releve-import] exception non gérée :", e);
    return Response.json(
      { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
