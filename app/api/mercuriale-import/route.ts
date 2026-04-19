import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

// ── Types ──────────────────────────────────────────────────────────────────

interface ExtractedProduct {
  nom: string;
  categorie: string;
  prix: number | null;
  unite: string;
  ancien_prix?: number | null;
  is_promo?: boolean;
}

type DocBlock = {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
};
type ImgBlock = {
  type: "image";
  source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };
};
type MsgContent = Anthropic.TextBlockParam | DocBlock | ImgBlock;

// ── Prompts ────────────────────────────────────────────────────────────────

function pdfPagePrompt(page: number, total: number, lastCat: string): string {
  return `Tu analyses la page ${page}/${total} d'une mercuriale fournisseur alimentaire.
Extrais TOUS les produits présents sur cette page.

FORMATS POSSIBLES :
1. Texte classique : NOM  UNITÉ  PRIX
2. Promotionnel : prix barré (ancien prix) + nouveau prix réduit
3. Détaillé : peut inclure DLC, poids/colis, référence — IGNORE ces infos, ne garde que nom/unité/prix

CATÉGORIE : détecte depuis les titres de sections en MAJUSCULES sur cette page.
Si aucun titre nouveau → continue avec "${lastCat}".
Mapping (utilise EXACTEMENT ces valeurs) :
- FRUITS                                            → "fruits"
- LÉGUMES, CHAMPIGNONS                              → "legumes"
- HERBES AROMATIQUES, FINES HERBES, BASILIC, MENTHE → "herbes"
- POMMES DE TERRE, PATATES                          → "pommes_de_terre"
- SALADES, LAITUES, JEUNES POUSSES                  → "salades"
- VIANDES, BOUCHERIE, VOLAILLES, CHARCUTERIE        → "boucherie"
- POISSONS, CRUSTACÉS, FRUITS DE MER                → "poissonnerie"
- CRÈMERIE, FROMAGES, PRODUITS LAITIERS, YAOURTS    → "cremerie"
- ÉPICERIE, CONDIMENTS, HUILES, ÉPICES              → "epicerie"

RÈGLES :
- prix = PRIX ACTUEL (nouveau prix si promotion, sinon prix normal)
- Si prix "NC" (non communiqué) → prix: null
- Si promotion (prix barré détecté) → ancien_prix = ancien prix, is_promo = true
- Ignorer DLC, poids/colis, références article
- Unités courantes : KG, K, U, PCE, BT, BTE, L, CS, FT, etc.

Retourne UNIQUEMENT un tableau JSON valide, sans texte ni markdown :
[{"nom":"Tomates cerises","unite":"KG","prix":4.50,"categorie":"legumes"},{"nom":"Saumon","unite":"KG","prix":18.00,"categorie":"poissonnerie","ancien_prix":22.00,"is_promo":true}]

Si aucun produit sur cette page : []`;
}

const IMAGE_PROMPT = `Tu analyses une image de mercuriale ou de liste de prix fournisseur alimentaire.
Extrais TOUS les produits visibles.

FORMATS POSSIBLES :
1. Texte classique : NOM  UNITÉ  PRIX
2. Promotionnel : prix barré (ancien prix) + nouveau prix réduit
3. Détaillé : peut inclure DLC, poids/colis, référence — IGNORE ces infos, ne garde que nom/unité/prix
4. Catalogue visuel : photos de produits avec étiquettes de prix

RÈGLES :
- prix = PRIX ACTUEL (nouveau prix si promotion, sinon prix normal)
- Si prix illisible ou "NC" → prix: null
- Si promotion (prix barré visible) → ancien_prix = ancien prix, is_promo = true
- Ignorer DLC, poids/colis, références article
- Catégories (valeurs exactes) : legumes, fruits, boucherie, poissonnerie, epicerie, herbes, pommes_de_terre, salades, cremerie
- Unités : KG, U, L, BT, lot, sac, etc.

Retourne UNIQUEMENT un tableau JSON valide, sans texte ni markdown :
[{"nom":"Tomates cerises","unite":"KG","prix":4.50,"categorie":"legumes"},{"nom":"Saumon","unite":"KG","prix":18.00,"categorie":"poissonnerie","ancien_prix":22.00,"is_promo":true}]`;

// ── Normalize units ────────────────────────────────────────────────────────

const UNITE_MAP: Record<string, string> = {
  kg: "kg", k: "kg", kilo: "kg",
  u: "pièce", pce: "pièce", piece: "pièce", pièce: "pièce",
  bt: "boîte", bte: "boîte", boite: "boîte", boîte: "boîte",
  l: "L", litre: "L", lt: "L",
  "barq.": "barq.", barq: "barq.",
  sac: "sac", lot: "lot", cs: "lot",
  "100g": "100g", ft: "100g",
};
function normalizeUnite(raw: string): string {
  return UNITE_MAP[raw.toLowerCase().trim()] ?? raw.toLowerCase().trim();
}

const VALID_CATS = new Set([
  "legumes", "fruits", "boucherie", "poissonnerie", "epicerie",
  "herbes", "pommes_de_terre", "salades", "cremerie",
]);

// ── Parse JSON response ────────────────────────────────────────────────────

function parseProducts(text: string): ExtractedProduct[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const raw: unknown[] = JSON.parse(match[0]);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map(p => ({
        nom:       String(p.nom ?? "").trim(),
        categorie: VALID_CATS.has(String(p.categorie)) ? String(p.categorie) : "epicerie",
        prix:      p.prix === null || p.prix === "NC" || p.prix === "" ? null
                   : isNaN(Number(p.prix)) ? null
                   : Math.round(Number(p.prix) * 100) / 100,
        unite:     normalizeUnite(String(p.unite ?? "kg")),
        ancien_prix: p.ancien_prix != null && !isNaN(Number(p.ancien_prix))
                     ? Math.round(Number(p.ancien_prix) * 100) / 100 : null,
        is_promo:  p.is_promo === true,
      }))
      .filter(p => p.nom.length > 1);
  } catch {
    return [];
  }
}

// ── Per-page PDF extractor ─────────────────────────────────────────────────

const MODEL_ID = "claude-sonnet-4-5";

async function extractPdfPage(
  anthropic: Anthropic,
  pdfBase64: string,
  page: number,
  total: number,
  lastCat: string,
): Promise<ExtractedProduct[]> {
  const content: MsgContent[] = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
    { type: "text", text: pdfPagePrompt(page, total, lastCat) },
  ];
  console.log(`[mercuriale-import] calling Anthropic (PDF page ${page}/${total}, model ${MODEL_ID})`);
  const msg = await (anthropic.messages.create as (
    body: Omit<Anthropic.MessageCreateParamsNonStreaming, "messages"> & {
      messages: { role: "user"; content: MsgContent[] }[];
    },
    opts?: Anthropic.RequestOptions,
  ) => Promise<Anthropic.Message>)(
    { model: MODEL_ID, max_tokens: 8096, messages: [{ role: "user", content }] },
    { headers: { "anthropic-beta": "pdfs-2024-09-25" } },
  );
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  console.log(`[mercuriale-import] page ${page} response length: ${text.length} chars`);
  const products = parseProducts(text);
  console.log(`[mercuriale-import] page ${page} parsed: ${products.length} products`);
  return products;
}

// ── Image extractor ────────────────────────────────────────────────────────

async function extractImage(
  anthropic: Anthropic,
  base64: string,
  mediaType: string,
): Promise<ExtractedProduct[]> {
  const mt = (mediaType === "image/jpg" ? "image/jpeg" : mediaType) as
    "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const content: MsgContent[] = [
    { type: "image", source: { type: "base64", media_type: mt, data: base64 } },
    { type: "text", text: IMAGE_PROMPT },
  ];
  console.log(`[mercuriale-import] calling Anthropic (image, model ${MODEL_ID})`);
  const msg = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 8096,
    messages: [{ role: "user", content: content as Anthropic.MessageParam["content"] }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  console.log(`[mercuriale-import] image response length: ${text.length} chars`);
  const products = parseProducts(text);
  console.log(`[mercuriale-import] image parsed: ${products.length} products`);
  return products;
}

// ── SSE ────────────────────────────────────────────────────────────────────

const enc = new TextEncoder();
function sse(ctrl: ReadableStreamDefaultController, data: object) {
  ctrl.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log("[mercuriale-import] POST received. ANTHROPIC_API_KEY present:", Boolean(apiKey), "len:", apiKey?.length);
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return Response.json({ error: "ANTHROPIC_API_KEY non configurée côté serveur (.env.local manquant ou variable absente sur Netlify)." }, { status: 500 });
  }

  let pdfBase64: string, pageCount: number, mediaType: string;
  try {
    ({ pdfBase64, pageCount = 1, mediaType = "application/pdf" } = await req.json());
    if (!pdfBase64) throw new Error("pdfBase64 manquant");
  } catch (e) {
    console.error("[mercuriale-import] body invalide:", e);
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  console.log("[mercuriale-import] mediaType:", mediaType, "pageCount:", pageCount, "base64 len:", pdfBase64.length);

  const anthropic  = new Anthropic({ apiKey });
  const isImage    = mediaType.startsWith("image/");
  const totalPages = isImage ? 1 : Math.min(Math.max(1, pageCount), 20);

  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        const all: ExtractedProduct[] = [];
        let lastCat = "epicerie";

        if (isImage) {
          sse(ctrl, { type: "progress", page: 1, totalPages: 1 });
          const products = await extractImage(anthropic, pdfBase64, mediaType);
          all.push(...products);
        } else {
          for (let page = 1; page <= totalPages; page++) {
            sse(ctrl, { type: "progress", page, totalPages });
            const products = await extractPdfPage(anthropic, pdfBase64, page, totalPages, lastCat);
            all.push(...products);
            const last = [...products].reverse().find(p => p.categorie);
            if (last) lastCat = last.categorie;
            if (products.length === 0 && page > 1) break;
          }
        }

        // Deduplicate by normalised name (first occurrence wins)
        const seen = new Set<string>();
        const deduped = all.filter(p => {
          const key = p.nom.toLowerCase().replace(/\s+/g, " ");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        console.log(`[mercuriale-import] done — ${deduped.length} produits uniques`);
        sse(ctrl, { type: "done", produits: deduped, total: deduped.length });
      } catch (e: unknown) {
        console.error("[mercuriale-import] EXTRACTION FAILED:", e);
        // Extract Anthropic-specific error details if available
        let msg = e instanceof Error ? e.message : "Erreur inconnue";
        const err = e as { status?: number; error?: { message?: string; type?: string } };
        if (err.status && err.error?.message) {
          msg = `Anthropic ${err.status} (${err.error.type ?? "error"}) : ${err.error.message}`;
        }
        sse(ctrl, { type: "error", error: msg });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}
