import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { extractText, getDocumentProxy } from "unpdf";

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

/**
 * Extraction texte brut d'un PDF via unpdf (pur Node, pas de
 * dépendance browser/DOMMatrix). Endpoint diag admin.
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

    const headBytes = Buffer.from(fileBase64.slice(0, 12), "base64").subarray(0, 4).toString("ascii");
    if (headBytes !== "%PDF") {
      return Response.json({ error: "Le fichier fourni n'est pas un PDF valide." }, { status: 415 });
    }
    const approxBytes = Math.ceil(fileBase64.length * 0.75);
    if (approxBytes > 10 * 1024 * 1024) {
      return Response.json(
        { error: `PDF trop volumineux (${(approxBytes / 1024 / 1024).toFixed(1)} Mo). Max 10 Mo.` },
        { status: 413 },
      );
    }

    const t0 = Date.now();
    const buffer = Buffer.from(fileBase64, "base64");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const res = await extractText(pdf, { mergePages: true });
    const text = (res.text as string).trim();
    const ms = Date.now() - t0;
    console.log(`[extract-pdf] ${res.totalPages} page(s), ${text.length} chars, ${ms}ms`);

    return Response.json({
      ok: true,
      text,
      pages: res.totalPages,
      char_count: text.length,
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
