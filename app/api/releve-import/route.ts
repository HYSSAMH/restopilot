import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime     = "nodejs";
export const maxDuration = 60;

const MODEL_ID = "claude-sonnet-4-5";

interface ParsedLigne {
  date:    string | null;
  libelle: string;
  debit:   number;
  credit:  number;
  solde:   number | null;
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

const PROMPT = `Tu analyses un RELEVÉ DE COMPTE BANCAIRE et tu extrais toutes les lignes d'opération en JSON strict.

RÈGLES :
- Retourne TOUTES les lignes visibles, même nombreuses (sans les tronquer).
- Format date : YYYY-MM-DD.
- Débit et crédit : positifs. Si une ligne est un débit, mets le montant dans "debit" et laisse "credit" à 0 (et inversement).
- "solde" = solde après opération si visible, sinon null.
- Si un champ est absent/illisible, mets null pour date/solde (jamais pour libelle).
- Pas de symbole € dans les nombres.

Retourne UNIQUEMENT le JSON (pas de markdown, pas de texte avant/après) :
{
  "periode_debut": "YYYY-MM-DD",
  "periode_fin":   "YYYY-MM-DD",
  "solde_debut":   1234.56,
  "solde_fin":     2345.67,
  "lignes": [
    { "date": "2026-04-01", "libelle": "VIR SEPA EDF", "debit": 120.50, "credit": 0, "solde": 3400.21 }
  ]
}`;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseReleve(text: string): ParsedReleve | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Partial<ParsedReleve>;
    const lignes = Array.isArray(raw.lignes) ? raw.lignes : [];
    return {
      periode_debut: raw.periode_debut ? String(raw.periode_debut) : null,
      periode_fin:   raw.periode_fin   ? String(raw.periode_fin)   : null,
      solde_debut:   num(raw.solde_debut),
      solde_fin:     num(raw.solde_fin),
      lignes: lignes.map((l: Partial<ParsedLigne>) => ({
        date:    l.date ? String(l.date) : null,
        libelle: l.libelle ? String(l.libelle).trim() : "",
        debit:   num(l.debit)  ?? 0,
        credit:  num(l.credit) ?? 0,
        solde:   num(l.solde),
      })).filter(l => l.libelle.length > 0),
    };
  } catch (e) {
    console.error("[releve-import] parse JSON error:", e);
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return Response.json({
    ok: Boolean(apiKey) && apiKey !== "your_anthropic_api_key_here",
    model_id: MODEL_ID,
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return Response.json({ error: "ANTHROPIC_API_KEY non configurée." }, { status: 500 });
  }

  let fileBase64: string;
  try {
    const body = await req.json();
    fileBase64 = body.fileBase64;
    if (!fileBase64) throw new Error("fileBase64 manquant");
  } catch (e) {
    return Response.json({ error: "Requête invalide : " + (e instanceof Error ? e.message : "body") }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const content: MsgContent[] = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } },
      { type: "text", text: PROMPT },
    ];

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

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    console.log(`[releve-import] ← ${Date.now() - t0}ms, ${text.length} chars`);

    const parsed = parseReleve(text);
    if (!parsed) {
      return Response.json({ error: "Réponse Claude non parsable.", raw: text.slice(0, 500) }, { status: 500 });
    }
    return Response.json({ ok: true, releve: parsed });
  } catch (e) {
    console.error("[releve-import] exception:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Erreur Claude" }, { status: 500 });
  }
}
