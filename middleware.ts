import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Role = "restaurateur" | "fournisseur" | "admin" | "employe";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isDashboard = path.startsWith("/dashboard");
  const isProfile   = path === "/profile" || path.startsWith("/profile/");
  const isAdmin     = path === "/admin"   || path.startsWith("/admin/");
  const isProtected = isDashboard || isProfile || isAdmin;
  const isAuthRoute =
    path === "/login" ||
    path === "/register" ||
    path.startsWith("/login/") ||
    path.startsWith("/register/");

  // Non authentifié + accès protégé → /login
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // On lit le rôle depuis profiles (source de vérité) plutôt que le metadata
  // pour capter les rôles créés côté serveur (employes).
  let role: Role = "restaurateur";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const candidate = (profile?.role as Role | undefined)
      ?? (user.user_metadata?.role as Role | undefined);
    if (candidate === "restaurateur" || candidate === "fournisseur"
      || candidate === "admin" || candidate === "employe") {
      role = candidate;
    }
  }

  // Authentifié + accès /login ou /register → son propre dashboard
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    if (role === "admin")          url.pathname = "/admin";
    else if (role === "employe")   url.pathname = "/dashboard/employe";
    else                           url.pathname = `/dashboard/${role}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Un employé est strictement confiné à /dashboard/employe.
    if (role === "employe") {
      const isEmployeZone = path.startsWith("/dashboard/employe");
      if (isProtected && !isEmployeZone) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/employe";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } else {
      // /admin/* réservé aux admins
      if (isAdmin && role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = role === "fournisseur"
          ? "/dashboard/fournisseur"
          : "/dashboard/restaurateur";
        return NextResponse.redirect(url);
      }

      // Non-employés ne doivent pas tomber sur la zone employé
      if (path.startsWith("/dashboard/employe")) {
        const url = request.nextUrl.clone();
        url.pathname = role === "admin"
          ? "/admin"
          : `/dashboard/${role}`;
        return NextResponse.redirect(url);
      }

      // Cloisonnement par rôle dans /dashboard/*
      // Exception : admin peut accéder à /dashboard/* pour agir "en tant que"
      if (isDashboard && role !== "admin") {
        if (path.startsWith("/dashboard/fournisseur") && role !== "fournisseur") {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard/restaurateur";
          return NextResponse.redirect(url);
        }
        if (path.startsWith("/dashboard/restaurateur") && role !== "restaurateur") {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard/fournisseur";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return response;
}

// Next.js 16 : on force le middleware en runtime Node pour éviter la
// couche Edge (dont l'erreur "edge function has crashed" sur Netlify
// lors du traitement de gros payloads). Node runtime permet aussi
// d'utiliser l'écosystème npm complet dans le middleware au besoin.
export const runtime = "nodejs";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/admin",
    "/admin/:path*",
    "/login",
    "/login/:path*",
    "/register",
    "/register/:path*",
  ],
};
