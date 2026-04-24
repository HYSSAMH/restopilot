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

    let role = (data.user.user_metadata?.role as "fournisseur" | "restaurateur" | undefined);
    if (!role) {
      const { data: prof } = await supabase
        .from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      role = (prof?.role as "fournisseur" | "restaurateur" | undefined) ?? "restaurateur";
    }

    router.push(redirect ?? `/dashboard/${role}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F8F9FA] px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-100/50 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <Link href="/" className="mb-8 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-[#1A1A2E]">
          <span>←</span><span>Retour à l&apos;accueil</span>
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[10px] text-white"
              style={{
                background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                boxShadow: "0 1px 2px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <span className="text-[15px] font-[700] tracking-[-0.02em]">RP</span>
            </div>
            <div>
              <h1 className="page-title">Connexion</h1>
              <p className="page-sub">Accédez à votre espace RestoPilot</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-[#1A1A2E]">Adresse email</label>
              <input
                id="email" type="email" required autoComplete="email"
                placeholder="vous@exemple.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-[#1A1A2E]">Mot de passe</label>
                <Link href="/reset-password" className="text-xs text-indigo-500 hover:text-indigo-600">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password"
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600" aria-label={showPassword ? "Masquer" : "Afficher"}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
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
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <p className="text-center text-sm text-gray-500">
            Pas encore de compte ?{" "}
            <Link href="/register" className="font-semibold text-indigo-500 hover:text-indigo-600">
              S&apos;inscrire
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Resto<span className="text-indigo-400">Pilot</span> · Tous droits réservés
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] text-gray-500">Chargement…</div>}>
      <LoginInner />
    </Suspense>
  );
}
