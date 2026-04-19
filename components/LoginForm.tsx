"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccentColor = "violet" | "purple";

interface LoginFormProps {
  role: "restaurateur" | "fournisseur";
  icon: string;
  title: string;
  subtitle: string;
  gradient: string;
  accentColor: AccentColor;
}

const accentClasses: Record<AccentColor, { ring: string; btn: string; link: string }> = {
  violet: {
    ring: "focus:ring-violet-500/50 focus:border-violet-500",
    btn: "bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 shadow-violet-500/30",
    link: "text-violet-400 hover:text-violet-300",
  },
  purple: {
    ring: "focus:ring-purple-500/50 focus:border-purple-500",
    btn: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 shadow-purple-500/30",
    link: "text-purple-400 hover:text-purple-300",
  },
};

export default function LoginForm({
  role,
  icon,
  title,
  subtitle,
  gradient,
  accentColor,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const accent = accentClasses[accentColor];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    router.push(`/dashboard/${role}`);
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-violet-700/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <span>←</span>
          <span>Retour à l&apos;accueil</span>
        </Link>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}
            >
              <span className="text-3xl">{icon}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              <p className="mt-1 text-sm text-white/50">{subtitle}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-white/70">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all ${accent.ring} focus:ring-2`}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-white/70">
                  Mot de passe
                </label>
                <Link href={`/reset-password?role=${role}`} className={`text-xs ${accent.link} transition-colors`}>
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 pr-12 text-sm text-white placeholder-white/25 outline-none transition-all ${accent.ring} focus:ring-2`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
                  aria-label={showPassword ? "Masquer" : "Afficher"}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`mt-1 flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200 ${accent.btn} disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-xl`}
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/25">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Register link */}
          <p className="text-center text-sm text-white/40">
            Pas encore de compte ?{" "}
            <Link href={`/register?role=${role}`} className={`font-medium ${accent.link} transition-colors`}>
              Créer un compte {role}
            </Link>
          </p>
        </div>

        {/* RestoPilot brand */}
        <p className="mt-6 text-center text-xs text-white/20">
          Resto<span className="text-violet-500/60">Pilot</span> · Tous droits réservés
        </p>
      </div>
    </main>
  );
}
