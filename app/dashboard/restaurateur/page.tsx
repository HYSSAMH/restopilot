"use client";

import Link from "next/link";
import Navbar from "@/components/dashboard/Navbar";
import { useProfile } from "@/lib/auth/use-profile";

export default function RestaurateurHome() {
  const { profile } = useProfile();
  const firstName = profile?.prenom || profile?.nom_etablissement || "";

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <Navbar role="restaurateur" />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-700/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-purple-500/8 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white">
            {firstName ? `Bonjour ${firstName}` : "Bienvenue"} 👋
          </h1>
          <p className="mt-2 text-white/50">
            Que souhaitez-vous faire aujourd&apos;hui ?
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            href="/dashboard/restaurateur/commandes"
            icon="🛒"
            title="Passer une commande"
            description="Parcourez le catalogue des fournisseurs et commandez au meilleur prix."
            gradient="from-violet-600 to-purple-500"
          />
          <ActionCard
            href="/dashboard/restaurateur/historique"
            icon="📋"
            title="Mes commandes"
            description="Suivez le statut de vos commandes en cours et passées."
            gradient="from-purple-500 to-pink-500"
          />
        </div>
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
