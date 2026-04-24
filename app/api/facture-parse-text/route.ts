import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseFactureText } from "@/lib/parse-facture";

export const runtime = "nodejs";
export const maxDuration = 10;

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

/**
 * POST /api/facture-parse-text
 * Body : { rawText: string } — utilisé par le fallback OCR client
 * (tesseract.js dans le navigateur → texte brut → parsing serveur).
 *
 * Renvoie { ok, facture, factures?, diagnostic } de la même forme que
 * /api/facture-import pour que la modal puisse réutiliser le même
 * code côté UI.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    let rawText: string;
    try {
      const body = await req.json();
      rawText = typeof body?.rawText === "string" ? body.rawText : "";
      if (!rawText) {
        return Response.json({ error: "rawText manquant." }, { status: 400 });
      }
    } catch (e) {
      return Response.json(
        { error: "Corps invalide : " + (e instanceof Error ? e.message : String(e)) },
        { status: 400 },
      );
    }

    if (rawText.length > 500_000) {
      return Response.json({ error: "Texte OCR trop volumineux (> 500 ko)." }, { status: 413 });
    }

    const factures = parseFactureText(rawText);
    if (factures.length === 0) {
      return Response.json(
        {
          error: "L'OCR n'a pas permis d'extraire de lignes reconnaissables. Éditez manuellement.",
          diagnostic: { char_count: rawText.length, raw_sample: rawText.slice(0, 400) },
        },
        { status: 422 },
      );
    }

    const facture = factures[0];
    return Response.json({
      ok: true,
      engine: "tesseract.js (client) + regex (server)",
      facture,
      factures: factures.length > 1 ? factures : undefined,
      diagnostic: { char_count: rawText.length, factures_count: factures.length },
    });
  } catch (e) {
    console.error("[facture-parse-text] exception:", e);
    return Response.json(
      { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
