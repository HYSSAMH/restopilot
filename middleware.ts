import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Role = "restaurateur" | "fournisseur";

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
  const isProtected = isDashboard || isProfile;
  const isAuthRoute =
    path === "/login" ||
    path === "/register" ||
    path.startsWith("/login/") ||
    path.startsWith("/register/");

  // Non authentifié + accès protégé → /login (avec retour après connexion)
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // Authentifié + accès /login ou /register → son propre dashboard
  if (isAuthRoute && user) {
    const role = (user.user_metadata?.role as Role | undefined) ?? "restaurateur";
    const url = request.nextUrl.clone();
    url.pathname = `/dashboard/${role}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Cloisonnement par rôle dans /dashboard/*
  if (isDashboard && user) {
    const role = (user.user_metadata?.role as Role | undefined) ?? "restaurateur";

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

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/login",
    "/login/:path*",
    "/register",
    "/register/:path*",
  ],
};
