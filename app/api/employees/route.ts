import { NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime     = "nodejs";
export const maxDuration = 30;

const ENV_MISSING = "SUPABASE_SERVICE_ROLE_KEY non configurée. Ajoutez-la dans Netlify Dashboard > Site settings > Environment variables (scope : server-only).";

/**
 * Retourne un client Supabase "admin" utilisant la service_role
 * pour contourner RLS (création/suppression de comptes auth).
 */
function adminClient() {
  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const skey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!skey) throw new Error(ENV_MISSING);
  return createAdminClient(url, skey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Récupère le patron connecté à partir des cookies Supabase.
 */
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

// ── GET : lister les employés du patron connecté ────────────────────────
// Indispensable depuis le fix RLS récursion : les policies profiles ne
// laissent plus le patron voir les lignes employés via le client anon.
// On utilise le service_role ici pour retourner la liste.
export async function GET() {
  const patron = await getPatron();
  if (!patron) return Response.json({ error: "Non authentifié." }, { status: 401 });
  if (patron.role !== "restaurateur") {
    return Response.json({ error: "Accès réservé aux restaurateurs." }, { status: 403 });
  }

  let admin;
  try { admin = adminClient(); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : ENV_MISSING }, { status: 500 }); }

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, prenom, nom, email, actif, created_at")
    .eq("restaurant_id", patron.id)
    .eq("role", "employe")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[employees GET] select failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Enrichit avec last_sign_in_at depuis auth.users (via service_role)
  type EmpRow = { id: string; prenom: string | null; nom: string | null; email: string | null; actif: boolean | null; created_at: string };
  const rows = (profiles ?? []) as EmpRow[];
  const withAuth = await Promise.all(rows.map(async (r) => {
    const { data: au } = await admin.auth.admin.getUserById(r.id);
    return { ...r, last_sign_in_at: au?.user?.last_sign_in_at ?? null };
  }));

  return Response.json({ ok: true, employes: withAuth });
}

// ── POST : créer un employé ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const patron = await getPatron();
  if (!patron) return Response.json({ error: "Non authentifié." }, { status: 401 });
  if (patron.role !== "restaurateur") {
    return Response.json({ error: "Seul un restaurateur peut créer un employé." }, { status: 403 });
  }

  let body: { prenom?: string; nom?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps invalide." }, { status: 400 });
  }
  const prenom   = (body.prenom   ?? "").trim();
  const nom      = (body.nom      ?? "").trim();
  const email    = (body.email    ?? "").trim().toLowerCase();
  const password = body.password  ?? "";
  if (!prenom || !nom) return Response.json({ error: "Prénom et nom requis." },   { status: 400 });
  if (!email)          return Response.json({ error: "Email requis." },            { status: 400 });
  if (password.length < 8) return Response.json({ error: "Mot de passe : 8 caractères minimum." }, { status: 400 });

  let admin;
  try { admin = adminClient(); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : ENV_MISSING }, { status: 500 }); }

  // 1. Création auth user
  const { data: created, error: errCreate } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role:              "employe",
      prenom,
      nom,
      nom_etablissement: `${prenom} ${nom}`,
    },
  });
  if (errCreate || !created.user) {
    console.error("[employees] createUser failed:", errCreate);
    const msg = errCreate?.message ?? "Erreur inconnue";
    return Response.json({ error: `Création échouée : ${msg}` }, { status: 400 });
  }

  // 2. Upsert profil employé avec restaurant_id = patron.id
  const { error: errProfile } = await admin.from("profiles").upsert({
    id:                created.user.id,
    role:              "employe",
    nom_etablissement: `${prenom} ${nom}`,
    prenom,
    nom,
    email,
    restaurant_id:     patron.id,
    actif:             true,
  }, { onConflict: "id" });

  if (errProfile) {
    console.error("[employees] profile upsert failed:", errProfile);
    // Rollback : suppression du user auth
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return Response.json({ error: `Création profil échouée : ${errProfile.message}` }, { status: 500 });
  }

  return Response.json({ ok: true, id: created.user.id });
}
