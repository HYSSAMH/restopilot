"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect");

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = createClient();

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr || !data.user) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    // Détermine le rôle (metadata d'abord, sinon profils)
    let role = (data.user.user_metadata?.role as "fournisseur" | "restaurateur" | undefined);
    if (!role) {
      const { data: prof } = await supabase
        .from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      role = (prof?.role as "fournisseur" | "restaurateur" | undefined) ?? "restaurateur";
    }

    router.push(redirect ?? `/dashboard/${role}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-violet-700/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <Link href="/" className="mb-8 flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70">
          <span>←</span><span>Retour à l&apos;accueil</span>
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg">
              <span className="text-3xl">🔐</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Connexion</h1>
              <p className="mt-1 text-sm text-white/50">Accédez à votre espace RestoPilot</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-white/70">Adresse email</label>
              <input
                id="email" type="email" required autoComplete="email"
                placeholder="vous@exemple.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-white/70">Mot de passe</label>
                <Link href="/reset-password" className="text-xs text-violet-400 transition-colors hover:text-violet-300">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password"
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 pr-12 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/50"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60" aria-label={showPassword ? "Masquer" : "Afficher"}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:from-violet-500 hover:to-purple-400 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : "Se connecter"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/25">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <p className="text-center text-sm text-white/40">
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-medium text-violet-400 transition-colors hover:text-violet-300">
              S&apos;inscrire
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          Resto<span className="text-violet-500/60">Pilot</span> · Tous droits réservés
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/40">Chargement…</div>}>
      <LoginInner />
    </Suspense>
  );
}
