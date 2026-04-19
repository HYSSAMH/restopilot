"use client";

import Link from "next/link";
import Navbar from "@/components/dashboard/Navbar";
import { useProfile } from "@/lib/auth/use-profile";

export default function FournisseurHome() {
  const { profile } = useProfile();
  const firstName = profile?.prenom || profile?.nom_etablissement || "";

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <Navbar role="fournisseur" />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-700/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-purple-500/8 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-white">
              {firstName ? `Bonjour ${firstName}` : "Bienvenue"} 👋
            </h1>
            <p className="mt-2 text-white/50">
              Gérez votre mercuriale et traitez vos commandes.
            </p>
          </div>
          <Link
            href="/profile"
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition-all hover:border-violet-500/40 hover:bg-violet-600/15 hover:text-violet-200"
          >
            <span>👤</span>
            <span>Mon profil</span>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            href="/dashboard/fournisseur/mercuriale"
            icon="📦"
            title="Ma mercuriale"
            description="Ajoutez, modifiez ou importez vos produits et tarifs."
            gradient="from-violet-600 to-purple-500"
          />
          <ActionCard
            href="/dashboard/fournisseur/commandes"
            icon="📥"
            title="Mes commandes reçues"
            description="Suivez et mettez à jour le statut des commandes des restaurateurs."
            gradient="from-purple-500 to-pink-500"
          />
        </div>

        {/* Bandeau "complétez votre profil" */}
        <Link
          href="/profile"
          className="mt-6 flex items-center gap-4 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-600/10 to-purple-500/10 p-5 transition-all hover:border-violet-500/50 hover:bg-violet-600/15"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 text-xl shadow-lg">
            👤
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">Complétez votre profil</p>
            <p className="mt-0.5 text-xs text-white/50">
              SIRET, IBAN, zone de livraison, horaires — apparaîtra sur les factures envoyées aux restaurateurs.
            </p>
          </div>
          <span className="shrink-0 text-violet-400">→</span>
        </Link>
      </main>
    </div>
  );
}

function ActionCard({
  href, icon, title, description, gradient,
}: {
  href: string; icon: string; title: string; description: string; gradient: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:bg-white/8 hover:shadow-xl hover:shadow-violet-500/10"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-white/50">{description}</p>
      </div>
      <div className="mt-auto flex items-center gap-2 text-sm font-medium text-violet-400 transition-all group-hover:gap-3">
        <span>Y accéder</span>
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}
