import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
export const maxDuration = 60;

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
 * Extrait le texte brut d'un PDF via pdf-parse (pas d'appel Anthropic ici).
 * Accepte un body JSON `{ fileBase64 }` ; retourne `{ text, pages, info }`.
 *
 * But : remplacer l'envoi base64 direct à Claude — le texte nettoyé améliore
 * drastiquement la précision d'extraction (factures, mercuriales, relevés).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    let fileBase64: string;
    try {
      const body = await req.json();
      fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : "";
      if (!fileBase64) return Response.json({ error: "fileBase64 manquant." }, { status: 400 });
    } catch (e) {
      return Response.json(
        { error: "Corps invalide : " + (e instanceof Error ? e.message : String(e)) },
        { status: 400 },
      );
    }

    // Vérif magic bytes + taille
    const headBytes = Buffer.from(fileBase64.slice(0, 12), "base64").subarray(0, 4).toString("ascii");
    if (headBytes !== "%PDF") {
      return Response.json({ error: "Le fichier fourni n'est pas un PDF valide." }, { status: 415 });
    }
    const approxBytes = Math.ceil(fileBase64.length * 0.75);
    if (approxBytes > 25 * 1024 * 1024) {
      return Response.json(
        { error: `PDF trop volumineux (${(approxBytes / 1024 / 1024).toFixed(1)} Mo). Max 25 Mo.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(fileBase64, "base64");

    // Import dynamique : pdf-parse charge un fichier de test au require, ce
    // qui casse sur certains bundlers. On importe le module interne qui
    // expose la fonction sans side-effects.
    // @ts-expect-error — pas de types publiés pour le sous-module
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = mod.default as
      (data: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number; info: Record<string, unknown>; metadata: unknown }>;

    const t0 = Date.now();
    const parsed = await pdfParse(buffer);
    const ms = Date.now() - t0;
    console.log(`[extract-pdf] ${parsed.numpages} page(s), ${parsed.text.length} chars, ${ms}ms`);

    return Response.json({
      ok: true,
      text: parsed.text,
      pages: parsed.numpages,
      char_count: parsed.text.length,
      duration_ms: ms,
    });
  } catch (e) {
    console.error("[extract-pdf] error:", e);
    return Response.json(
      { error: "Extraction PDF échouée : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
