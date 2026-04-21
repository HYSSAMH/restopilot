import { NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
export const maxDuration = 30;

const ENV_MISSING = "SUPABASE_SERVICE_ROLE_KEY non configurée. Ajoutez-la dans Netlify Dashboard > Site settings > Environment variables (scope : server-only).";

function adminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const skey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!skey) throw new Error(ENV_MISSING);
  return createAdminClient(url, skey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getPatron() {
  const cookieStore = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supa.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  return profile as { id: string; role: string } | null;
}

// ── DELETE : supprimer un employé ────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext<"/api/employees/[id]">,
) {
  const patron = await getPatron();
  if (!patron) return Response.json({ error: "Non authentifié." }, { status: 401 });
  if (patron.role !== "restaurateur") {
    return Response.json({ error: "Seul un restaurateur peut supprimer un employé." }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return Response.json({ error: "Identifiant manquant." }, { status: 400 });

  let admin;
  try { admin = adminClient(); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : ENV_MISSING }, { status: 500 }); }

  // Vérifie que l'employé appartient bien au patron
  const { data: target, error: errFetch } = await admin
    .from("profiles")
    .select("id, role, restaurant_id")
    .eq("id", id)
    .maybeSingle();

  if (errFetch) {
    return Response.json({ error: `Lecture profil échouée : ${errFetch.message}` }, { status: 500 });
  }
  if (!target) return Response.json({ error: "Employé introuvable." }, { status: 404 });
  if (target.role !== "employe" || target.restaurant_id !== patron.id) {
    return Response.json({ error: "Cet employé ne vous appartient pas." }, { status: 403 });
  }

  // Suppression de l'utilisateur auth — cascade supprime la ligne profiles
  const { error: errDelete } = await admin.auth.admin.deleteUser(id);
  if (errDelete) {
    console.error("[employees] deleteUser failed:", errDelete);
    return Response.json({ error: `Suppression échouée : ${errDelete.message}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
