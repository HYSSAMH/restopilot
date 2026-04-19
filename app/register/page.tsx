"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "restaurateur" | "fournisseur";

const ROLES: { id: Role; label: string; icon: string; sub: string; gradient: string }[] = [
  {
    id: "restaurateur",
    label: "Restaurateur",
    icon: "🍽️",
    sub: "Je gère un restaurant et je commande auprès de fournisseurs",
    gradient: "from-violet-600 to-purple-500",
  },
  {
    id: "fournisseur",
    label: "Distributeur / Fournisseur",
    icon: "🚚",
    sub: "Je vends des produits aux restaurateurs",
    gradient: "from-purple-500 to-pink-500",
  },
];

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (params.get("role") as Role | null) ?? null;

  const [role, setRole]                     = useState<Role | null>(initialRole);
  const [nomEtablissement, setNomEtab]      = useState("");
  const [prenom, setPrenom]                 = useState("");
  const [nom, setNom]                       = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirm]       = useState("");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!role)                       return setError("Choisissez votre rôle (Restaurateur ou Distributeur).");
    if (!nomEtablissement.trim())    return setError("Le nom de l'établissement est requis.");
    if (!email.trim())               return setError("L'email est requis.");
    if (password.length < 8)         return setError("Le mot de passe doit faire au moins 8 caractères.");
    if (password !== confirmPassword) return setError("Les mots de passe ne correspondent pas.");

    setLoading(true);
    const supabase = createClient();
    const etab = nomEtablissement.trim();

    // ── 1. signUp ─────────────────────────────────────────────────────
    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          role,
          nom_etablissement: etab,
          prenom: prenom.trim() || null,
          nom:    nom.trim()    || null,
        },
      },
    });

    if (authErr) {
      console.error("[register] signUp error", authErr);
      let msg = authErr.message;
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        msg = "Un compte existe déjà pour cet email. Essayez de vous connecter.";
      } else if (msg.toLowerCase().includes("password")) {
        msg = `Mot de passe refusé : ${authErr.message}`;
      } else if (msg.toLowerCase().includes("email")) {
        msg = `Email invalide : ${authErr.message}`;
      } else {
        msg = `Erreur Supabase Auth : ${authErr.message}`;
      }
      setError(msg);
      setLoading(false);
      return;
    }

    if (!data.user) {
      console.error("[register] no user returned from signUp", data);
      setError("Aucun utilisateur créé (réponse inattendue de Supabase). Réessayez.");
      setLoading(false);
      return;
    }

    // ── 2. Confirmation email activée → on stoppe ici ──────────────────
    if (!data.session) {
      setSuccess("Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.");
      setLoading(false);
      return;
    }

    // ── 3. Session OK → on s'assure que profile + fournisseur existent ─
    // (le trigger SQL les crée en principe ; on agit en filet de sécurité)
    const userId = data.user.id;

    const { data: existingProfile, error: selProfErr } = await supabase
      .from("profiles").select("id, role").eq("id", userId).maybeSingle();

    if (selProfErr) {
      console.error("[register] select profiles failed", selProfErr);
      setError(
        `Compte créé mais lecture du profil impossible : ${selProfErr.message}. ` +
        `Vérifiez que la migration SQL 'migration_auth_fix.sql' a été exécutée dans Supabase.`,
      );
      setLoading(false);
      return;
    }

    if (!existingProfile) {
      console.warn("[register] profile row missing — trigger didn't fire, creating from client");
      const { error: insProfErr } = await supabase.from("profiles").insert({
        id: userId,
        role,
        nom_etablissement: etab,
        prenom: prenom.trim() || null,
        nom:    nom.trim()    || null,
        email:  email.trim(),
      });
      if (insProfErr) {
        console.error("[register] insert profile failed", insProfErr);
        setError(
          `Compte auth créé mais l'insertion du profil a échoué : ${insProfErr.message} ` +
          `(code ${insProfErr.code ?? "?"}). ` +
          `Cause probable : RLS bloque l'INSERT sur 'profiles'. ` +
          `Exécutez 'supabase/migration_auth_fix.sql' dans Supabase SQL Editor.`,
        );
        setLoading(false);
        return;
      }
    }

    // Pour un fournisseur, on s'assure aussi qu'une ligne 'fournisseurs' existe
    if (role === "fournisseur") {
      const { data: fExist, error: selFErr } = await supabase
        .from("fournisseurs").select("id").eq("id", userId).maybeSingle();

      if (selFErr) {
        console.error("[register] select fournisseurs failed", selFErr);
        setError(`Lecture fournisseurs impossible : ${selFErr.message}`);
        setLoading(false);
        return;
      }

      if (!fExist) {
        console.warn("[register] fournisseurs row missing — creating from client");
        const { error: insFErr } = await supabase.from("fournisseurs").insert({
          id:       userId,
          nom:      etab,
          initiale: etab.charAt(0).toUpperCase() || "?",
          avatar:   "from-violet-600 to-purple-500",
          email:    email.trim(),
          minimum:  0,
          delai:    "J+1",
          note:     4.5,
        });
        if (insFErr) {
          console.error("[register] insert fournisseurs failed", insFErr);
          setError(
            `Compte créé mais la fiche fournisseur n'a pas pu être créée : ${insFErr.message} ` +
            `(code ${insFErr.code ?? "?"}). ` +
            `Cause probable : RLS bloque l'INSERT sur 'fournisseurs'. ` +
            `Exécutez 'supabase/migration_auth_fix.sql' dans Supabase SQL Editor.`,
          );
          setLoading(false);
          return;
        }
      }
    }

    // ── 4. Tout est OK → redirection vers le bon dashboard ─────────────
    router.push(`/dashboard/${role}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-violet-100/50 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg animate-fade-in-up">
        <Link href="/" className="mb-6 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-[#1A1A2E]">
          <span>←</span><span>Retour à l&apos;accueil</span>
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-[#1A1A2E]">Créer mon compte</h1>
            <p className="mt-1 text-sm text-gray-500">Gratuit · 2 minutes</p>
          </div>

          {/* ── Choix du rôle ─────────────────────────────────── */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-medium text-[#1A1A2E]">Je suis :</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ROLES.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                    role === r.id
                      ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
                      : "border-gray-200 bg-white hover:bg-white"
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${r.gradient}`}>
                    <span className="text-lg">{r.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${role === r.id ? "text-[#1A1A2E]" : "text-[#1A1A2E]/80"}`}>{r.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Formulaire ────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="reg-etab" className="mb-1.5 block text-xs font-medium text-[#1A1A2E]">
                Nom de l&apos;établissement *
              </label>
              <input
                id="reg-etab" name="nom_etablissement" autoComplete="organization" required
                value={nomEtablissement} onChange={e => setNomEtab(e.target.value)}
                placeholder={role === "fournisseur" ? "ex : ProFrais Distribution" : "ex : Le Bistrot Parisien"}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-prenom" className="mb-1.5 block text-xs font-medium text-[#1A1A2E]">Prénom</label>
                <input
                  id="reg-prenom" name="given-name" autoComplete="given-name"
                  value={prenom} onChange={e => setPrenom(e.target.value)}
                  placeholder="Marc"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="reg-nom" className="mb-1.5 block text-xs font-medium text-[#1A1A2E]">Nom</label>
                <input
                  id="reg-nom" name="family-name" autoComplete="family-name"
                  value={nom} onChange={e => setNom(e.target.value)}
                  placeholder="Dupont"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-[#1A1A2E]">Adresse email *</label>
              <input
                id="reg-email" name="email" required type="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-password" className="mb-1.5 block text-xs font-medium text-[#1A1A2E]">Mot de passe *</label>
                <input
                  id="reg-password" name="new-password" required type="password" autoComplete="new-password" minLength={8}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="8+ caractères"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="reg-password-confirm" className="mb-1.5 block text-xs font-medium text-[#1A1A2E]">Confirmation *</label>
                <input
                  id="reg-password-confirm" name="new-password-confirm" required type="password" autoComplete="new-password"
                  value={confirmPassword} onChange={e => setConfirm(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{success}</div>
            )}

            <button
              type="submit" disabled={loading || !!success}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-indigo-500 text-sm font-semibold text-[#1A1A2E] shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : "Créer mon compte"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Déjà inscrit ?{" "}
            <Link href="/login" className="font-medium text-indigo-500 transition-colors hover:text-indigo-600">
              Se connecter
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Resto<span className="text-violet-500/60">Pilot</span> · Tous droits réservés
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-500">Chargement…</div>}>
      <RegisterInner />
    </Suspense>
  );
}
