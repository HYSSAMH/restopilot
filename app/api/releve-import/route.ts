import { NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
// Désormais la route ne fait que déléguer à la Supabase Edge Function.
// L'extraction elle-même (Claude, parallélisation, parsing) tourne côté
// Deno sans contrainte de timeout Netlify. 30 s suffisent largement pour
// l'upload du PDF + insertion job + fire-and-forget.
export const maxDuration = 30;

const ENV_MISSING = (k: string) =>
  `${k} manquante. Ajoutez-la dans Netlify Dashboard > Site settings > Environment variables (scope server).`;

function adminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const skey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url)  throw new Error(ENV_MISSING("NEXT_PUBLIC_SUPABASE_URL"));
  if (!skey) throw new Error(ENV_MISSING("SUPABASE_SERVICE_ROLE_KEY"));
  return createAdminClient(url, skey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getUser() {
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
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  return Response.json({
    ok: hasKey && !!url,
    strategy: "async-edge-function",
    edge_url: url ? `${url.replace(/\/$/, "")}/functions/v1/process-releve` : null,
    service_role_key_present: hasKey,
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    }

    let fileBase64: string;
    let filename: string;
    let pageCount: number | undefined;
    try {
      const body = await req.json();
      fileBase64 = typeof body?.fileBase64 === "string" ? body.fileBase64 : "";
      filename   = typeof body?.filename   === "string" ? body.filename   : "releve.pdf";
      pageCount  = typeof body?.pageCount  === "number" ? body.pageCount  : undefined;
      if (!fileBase64) {
        return Response.json({ error: "fileBase64 manquant." }, { status: 400 });
      }
    } catch (e) {
      return Response.json(
        { error: "Corps de requête invalide : " + (e instanceof Error ? e.message : String(e)) },
        { status: 400 },
      );
    }

    const approxBytes = Math.ceil(fileBase64.length * 0.75);
    if (approxBytes > 25 * 1024 * 1024) {
      return Response.json(
        { error: `Fichier trop volumineux (${(approxBytes / 1024 / 1024).toFixed(1)} Mo). Max 25 Mo.` },
        { status: 413 },
      );
    }

    // Vérif magic bytes : un PDF valide commence par "%PDF"
    // (on décode seulement les 8 premiers octets pour rester léger).
    const head = Buffer.from(fileBase64.slice(0, 12), "base64").subarray(0, 4).toString("ascii");
    if (head !== "%PDF") {
      return Response.json(
        { error: `Fichier invalide : ce n'est pas un PDF (signature "${head}"). Seuls les PDFs sont acceptés.` },
        { status: 415 },
      );
    }

    const admin = adminClient();

    // 1. Création du job
    const { data: job, error: errJob } = await admin
      .from("import_jobs")
      .insert({
        restaurateur_id: user.id,
        type:            "releve",
        status:          "pending",
        source_filename: filename,
        page_count:      pageCount ?? null,
      })
      .select("id")
      .single();

    if (errJob || !job) {
      console.error("[releve-import] insert job failed:", errJob);
      return Response.json(
        { error: "Création du job échouée : " + (errJob?.message ?? "unknown") },
        { status: 500 },
      );
    }

    // 2. Upload PDF dans storage.releves/<uid>/<job_id>.pdf
    const path = `${user.id}/${job.id}.pdf`;
    // Décode le base64 → Uint8Array pour l'upload
    const binary = Buffer.from(fileBase64, "base64");

    const { error: errUp } = await admin.storage
      .from("releves")
      .upload(path, binary, { contentType: "application/pdf", upsert: true });

    if (errUp) {
      console.error("[releve-import] upload storage failed:", errUp);
      await admin.from("import_jobs").update({
        status: "error",
        error_message: "Upload PDF échoué : " + errUp.message,
        finished_at: new Date().toISOString(),
      }).eq("id", job.id);
      return Response.json({ error: "Upload PDF échoué : " + errUp.message }, { status: 500 });
    }

    await admin.from("import_jobs").update({ pdf_path: path }).eq("id", job.id);

    // 3. Déclenche l'Edge Function en fire-and-forget
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const edgeUrl    = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/process-releve`;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // On await brièvement pour confirmer que l'Edge Function a pris la main
    // (elle répond 202 quasi-instantanément grâce à EdgeRuntime.waitUntil).
    // Timeout court pour ne pas bloquer si la fonction est indisponible.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const trig = await fetch(edgeUrl, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ job_id: job.id }),
      });
      if (!trig.ok) {
        const txt = await trig.text().catch(() => "");
        console.error("[releve-import] edge trigger non-200:", trig.status, txt.slice(0, 200));
        // On ne bloque pas — le job reste "pending", un retry serait possible
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[releve-import] edge trigger failed:", msg);
      // On continue quand même — le job existe, l'utilisateur peut voir
      // qu'il n'avance pas et relancer.
    } finally {
      clearTimeout(timer);
    }

    return Response.json({ ok: true, job_id: job.id });
  } catch (e) {
    console.error("[releve-import] exception :", e);
    return Response.json(
      { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
