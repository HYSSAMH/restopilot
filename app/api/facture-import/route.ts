import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
export const maxDuration = 300;

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

const MODEL_ID = "claude-sonnet-4-5";

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
  };
  numero_facture: string | null;
  date:           string | null;  // YYYY-MM-DD
  lignes:         ParsedLigne[];
  montant_ht:     number | null;
  tva:            number | null;
  montant_ttc:    number | null;
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

// ── Prompts ───────────────────────────────────────────────────────────────

/** Prompt optimisé pour du TEXTE extrait d'une facture française (pdf-parse). */
const PROMPT_TEXT = `Tu es un expert en comptabilité française.
Voici le texte brut d'une facture fournisseur d'un restaurateur. Extrais TOUTES les informations en JSON strict.

CONSIGNES :
- Date au format YYYY-MM-DD (convertis depuis JJ/MM/AAAA ou JJ/MM/AA).
- Montants en nombres décimaux (pas de symbole €, pas de séparateur de milliers).
- Si une valeur est absente / illisible → null (ne jamais inventer).
- SIRET : uniquement les chiffres, pas d'espaces.
- Lignes produits : capture précisément la description complète, la quantité, l'unité (kg, pièce, carton, boîte, L, barq., lot, sac, 100g), le prix unitaire HT, le total HT. Si un conditionnement est indiqué (« carton de 8 × 800g »), inclus-le dans la description.
- Catégorie : choisis parmi legumes, fruits, boucherie, poissonnerie, epicerie, herbes, pommes_de_terre, salades, cremerie — epicerie par défaut si incertain.

Retourne UNIQUEMENT le JSON brut (pas de markdown, pas de commentaire) :
{
  "fournisseur": {
    "nom":       "...",
    "siret":     "...",
    "adresse":   "...",
    "telephone": "...",
    "email":     "..."
  },
  "numero_facture": "...",
  "date":           "YYYY-MM-DD",
  "lignes": [
    {
      "nom":           "Tomates grappes carton 6kg",
      "categorie":     "legumes",
      "quantite":      2,
      "unite":         "carton",
      "prix_unitaire": 12.50,
      "total":         25.00
    }
  ],
  "montant_ht":  123.45,
  "tva":         12.34,
  "montant_ttc": 135.79
}`;

/** Prompt optimisé pour les IMAGES de factures (JPG/PNG, mode vision). */
const PROMPT_IMAGE = `Cette image est une facture fournisseur française (restauration).
Extrais TOUS les produits visibles avec leurs prix en JSON strict.

ATTENTION PARTICULIÈRE À :
- Prix barrés (promotions) → conserve le PRIX ACTUEL (nouveau prix), pas le prix barré
- Conditionnements : « carton de 8 », « lot de 6 », « pack de 12 » — inclus dans la description
- Unités exactes : kg, pièce, carton, boîte, L, barq., lot, sac, 100g
- Quantités décimales (ex : 2.5 kg)
- SIRET : chiffres sans espaces ; date YYYY-MM-DD

Si une valeur est illisible → null.
Catégories valides : legumes, fruits, boucherie, poissonnerie, epicerie, herbes, pommes_de_terre, salades, cremerie.

Retourne UNIQUEMENT le JSON brut :
{
  "fournisseur": { "nom": "...", "siret": "...", "adresse": "...", "telephone": "...", "email": "..." },
  "numero_facture": "...",
  "date": "YYYY-MM-DD",
  "lignes": [{ "nom": "...", "categorie": "legumes", "quantite": 2, "unite": "kg", "prix_unitaire": 4.50, "total": 9.00 }],
  "montant_ht": 123.45,
  "tva": 12.34,
  "montant_ttc": 135.79
}`;

const VALID_CATS = new Set([
  "legumes","fruits","boucherie","poissonnerie","epicerie",
  "herbes","pommes_de_terre","salades","cremerie",
]);

function parseFacture(text: string): ParsedFacture | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Partial<ParsedFacture>;
    const four = (raw.fournisseur ?? {}) as Record<string, unknown>;
    const lignes = Array.isArray(raw.lignes) ? raw.lignes : [];
    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : Math.round(n * 100) / 100;
    };
    return {
      fournisseur: {
        nom:       four.nom       ? String(four.nom).trim()       : null,
        siret:     four.siret     ? String(four.siret).replace(/\s/g, "") : null,
        adresse:   four.adresse   ? String(four.adresse).trim()   : null,
        telephone: four.telephone ? String(four.telephone).trim() : null,
        email:     four.email     ? String(four.email).trim()     : null,
      },
      numero_facture: raw.numero_facture ? String(raw.numero_facture).trim() : null,
      date:           raw.date           ? String(raw.date)                  : null,
      lignes: lignes.map((l: Partial<ParsedLigne>) => {
        const cat = l.categorie ? String(l.categorie) : "epicerie";
        const qte = l.quantite != null ? Number(l.quantite) : 0;
        const pu  = num(l.prix_unitaire) ?? 0;
        const tot = num(l.total) ?? (qte * pu);
        return {
          nom:           l.nom ? String(l.nom).trim() : "",
          categorie:     VALID_CATS.has(cat) ? cat : "epicerie",
          quantite:      qte,
          unite:         l.unite ? String(l.unite).trim() : "pièce",
          prix_unitaire: pu,
          total:         tot,
        };
      }).filter(l => l.nom.length > 1),
      montant_ht:  num(raw.montant_ht),
      tva:         num(raw.tva),
      montant_ttc: num(raw.montant_ttc),
    };
  } catch (e) {
    console.error("[facture-import] parse JSON error:", e);
    return null;
  }
}

// ── GET diagnostic ────────────────────────────────────────────────────────

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return Response.json({
    ok: Boolean(apiKey) && apiKey !== "your_anthropic_api_key_here",
    anthropic_key_present: Boolean(apiKey),
    anthropic_key_length:  apiKey?.length ?? 0,
    model_id: MODEL_ID,
  });
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth requise : endpoint privé (consomme des crédits Anthropic)
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    return Response.json({ error: "ANTHROPIC_API_KEY non configurée." }, { status: 500 });
  }

  let fileBase64: string, mediaType: string;
  try {
    const body = await req.json();
    fileBase64 = body.fileBase64;
    mediaType  = body.mediaType ?? "application/pdf";
    if (!fileBase64) throw new Error("fileBase64 manquant");
  } catch (e) {
    return Response.json({ error: "Requête invalide : " + (e instanceof Error ? e.message : "body") }, { status: 400 });
  }

  console.log("[facture-import] POST — mediaType:", mediaType, "base64 len:", fileBase64.length);

  const anthropic = new Anthropic({ apiKey });
  const isImage   = mediaType.startsWith("image/");

  try {
    // PDF → extraction texte préalable via pdf-parse (gains de précision
    // vs envoi direct du base64 à Claude). Les images passent toujours par
    // le canal vision d'Anthropic.
    let extractedText = "";
    if (!isImage) {
      try {
        // @ts-expect-error — pas de types publiés pour le sous-module
        const mod = await import("pdf-parse/lib/pdf-parse.js");
        const pdfParse = mod.default as
          (data: Buffer) => Promise<{ text: string; numpages: number }>;
        const t0 = Date.now();
        const parsedPdf = await pdfParse(Buffer.from(fileBase64, "base64"));
        extractedText = parsedPdf.text;
        console.log(`[facture-import] pdf-parse ${parsedPdf.numpages}p, ${extractedText.length} chars, ${Date.now() - t0}ms`);
      } catch (pdfErr) {
        console.warn("[facture-import] pdf-parse failed, fallback vers envoi PDF direct :", pdfErr);
      }
    }

    const hasText = extractedText && extractedText.trim().length > 50;
    const mode: "text" | "image" | "pdf-direct" = isImage ? "image" : hasText ? "text" : "pdf-direct";
    console.log(`[facture-import] mode: ${mode}`);

    const content: MsgContent[] = mode === "image"
      ? [
          { type: "image",
            source: {
              type: "base64",
              media_type: (mediaType === "image/jpg" ? "image/jpeg" : mediaType) as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: fileBase64,
            },
          },
          { type: "text", text: PROMPT_IMAGE },
        ]
      : mode === "text"
        ? [
            // Claude reçoit le texte nettoyé — accuracy drastiquement meilleure
            { type: "text", text: PROMPT_TEXT + "\n\n--- DÉBUT DU TEXTE EXTRAIT ---\n" + extractedText + "\n--- FIN ---" },
          ]
        : [
            // Fallback : PDF scanné (image-only) — on envoie le PDF brut à Claude
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } },
            { type: "text", text: PROMPT_IMAGE },
          ];

    const usePdfBeta = mode === "pdf-direct";
    const t0 = Date.now();
    const msg = await (anthropic.messages.create as (
      body: Omit<Anthropic.MessageCreateParamsNonStreaming, "messages"> & {
        messages: { role: "user"; content: MsgContent[] }[];
      },
      opts?: Anthropic.RequestOptions,
    ) => Promise<Anthropic.Message>)(
      { model: MODEL_ID, max_tokens: 4096, messages: [{ role: "user", content }] },
      usePdfBeta ? { headers: { "anthropic-beta": "pdfs-2024-09-25" } } : {},
    );

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    console.log(`[facture-import] ← ${Date.now() - t0}ms, ${text.length} chars (mode: ${mode})`);

    const parsed = parseFacture(text);
    if (!parsed) {
      console.warn("[facture-import] JSON non parsable, début réponse :", text.slice(0, 300));
      return Response.json({ error: "Réponse Claude non parsable en JSON.", raw: text.slice(0, 500) }, { status: 500 });
    }

    console.log(`[facture-import] ✅ ${parsed.lignes.length} lignes extraites de ${parsed.fournisseur.nom ?? "fournisseur inconnu"}`);
    return Response.json({ facture: parsed });
  } catch (e: unknown) {
    console.error("[facture-import] ❌", e);
    const err = e as { status?: number; error?: { message?: string; type?: string } };
    const msg = err.status && err.error?.message
      ? `Anthropic ${err.status} (${err.error.type ?? "error"}) : ${err.error.message}`
      : e instanceof Error ? e.message : "Erreur inconnue";
    return Response.json({ error: msg }, { status: 500 });
  }
}
