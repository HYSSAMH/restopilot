import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
export const maxDuration = 10;

export async function GET(
  _req: NextRequest,
  { params }: RouteContext<"/api/releve-status/[job_id]">,
) {
  try {
    const { job_id } = await params;
    if (!job_id) return Response.json({ error: "job_id manquant" }, { status: 400 });

    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    const { data: job, error } = await supa
      .from("import_jobs")
      .select("id, type, status, page_count, result, error_message, started_at, finished_at, created_at")
      .eq("id", job_id)
      .eq("restaurateur_id", user.id)
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (!job) return Response.json({ error: "Job introuvable." }, { status: 404 });

    return Response.json({ ok: true, job });
  } catch (e) {
    return Response.json(
      { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
