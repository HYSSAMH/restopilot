import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseFactureText } from "@/lib/parse-facture";

export const runtime = "nodejs";
export const maxDuration = 26;

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

export async function GET() {
  return Response.json({
    ok: true,
    engine: "unpdf + regex (texte natif, fallback OCR client si PDF scanné)",
    runtime: "nodejs",
    max_duration_s: 26,
  });
}

/**
 * POST /api/facture-import
 * Body JSON :
 *   { fileBase64: string, mediaType: "application/pdf" }
 *
 * Réponses :
 *   - Texte natif OK :
 *     { ok: true, facture: ParsedFacture, factures?: [...], diagnostic }
 *   - PDF scanné (texte insuffisant) :
 *     { ok: false, needsOcr: true, totalPages, message }
 *     → le client bascule sur tesseract.js puis /api/facture-parse-text
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    let fileBase64: string;
    let mediaType: string;
    try {
      const body = await req.json();
      fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : "";
      mediaType = typeof body?.mediaType === "string" ? body.mediaType : "application/pdf";
      if (!fileBase64) {
        return Response.json({ error: "fileBase64 manquant." }, { status: 400 });
      }
    } catch (e) {
      return Response.json(
        { error: "Corps invalide : " + (e instanceof Error ? e.message : String(e)) },
        { status: 400 },
      );
    }

    if (!mediaType.startsWith("application/pdf")) {
      return Response.json(
        { error: "Format non supporté. Seul le PDF est pris en charge côté serveur (les images/scans passent par OCR côté client)." },
        { status: 415 },
      );
    }

    // Magic bytes + taille
    const head = Buffer.from(fileBase64.slice(0, 12), "base64").subarray(0, 4).toString("ascii");
    if (head !== "%PDF") {
      return Response.json({ error: "Fichier invalide : ce n'est pas un PDF." }, { status: 415 });
    }
    const approxBytes = Math.ceil(fileBase64.length * 0.75);
    if (approxBytes > 10 * 1024 * 1024) {
      return Response.json(
        { error: `PDF trop volumineux (${(approxBytes / 1024 / 1024).toFixed(1)} Mo). Max 10 Mo.` },
        { status: 413 },
      );
    }

    // Extraction texte via unpdf — import dynamique pour éviter un
    // crash au cold-start si le module tarde à charger côté serverless.
    let text = "";
    let totalPages = 0;
    try {
      const t0 = Date.now();
      const { extractText, getDocumentProxy } = await import("unpdf");
      const buffer = Buffer.from(fileBase64, "base64");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const res = await extractText(pdf, { mergePages: true });
      text = (res.text as string).trim();
      totalPages = res.totalPages;
      console.log(`[facture-import] unpdf ${totalPages}p, ${text.length} chars, ${Date.now() - t0}ms`);
    } catch (e) {
      console.error("[facture-import] unpdf failed:", e);
      return Response.json(
        { error: "Extraction PDF échouée : " + (e instanceof Error ? e.message : String(e)) },
        { status: 500 },
      );
    }

    // Si texte trop faible → PDF scanné, le client fait l'OCR.
    // Seuil : 50 caractères (tout en-tête générique = > 100, scanné = 0-20).
    if (text.length < 50) {
      return Response.json({
        ok: false,
        needsOcr: true,
        totalPages,
        message: "PDF scanné détecté — OCR côté client nécessaire.",
      });
    }

    const factures = parseFactureText(text);
    if (factures.length === 0) {
      return Response.json(
        {
          error: "Aucune ligne de facture n'a pu être extraite automatiquement. Format non reconnu — complétez manuellement.",
          diagnostic: {
            pages: totalPages,
            char_count: text.length,
            raw_sample: text.slice(0, 400),
          },
        },
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
      engine: "unpdf + regex",
      facture,
      factures: factures.length > 1 ? factures : undefined,
      diagnostic: {
        pages: totalPages,
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
