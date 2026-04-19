"use client";

import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useProfile } from "@/lib/auth/use-profile";

export default function FournisseurHome() {
  const { profile } = useProfile();
  const firstName = profile?.prenom || profile?.nom_commercial || profile?.nom_etablissement || "";

  return (
    <DashboardLayout role="fournisseur">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">
              Bonjour{firstName ? ` ${firstName}` : ""} 👋
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Gérez votre mercuriale et traitez vos commandes.
            </p>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#1A1A2E] shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-600"
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
          />
          <ActionCard
            href="/dashboard/fournisseur/commandes"
            icon="📥"
            title="Mes commandes reçues"
            description="Suivez et mettez à jour le statut des commandes des restaurateurs."
          />
        </div>

        <Link
          href="/profile"
          className="mt-5 flex items-center gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 transition-all hover:border-indigo-200"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xl text-white shadow-md shadow-indigo-500/20">
            👤
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[#1A1A2E]">Complétez votre profil</p>
            <p className="mt-0.5 text-xs text-gray-500">
              SIRET, IBAN, zone de livraison, horaires — apparaît sur les factures envoyées aux restaurateurs.
            </p>
          </div>
          <span className="shrink-0 text-indigo-500">→</span>
        </Link>
      </div>
    </DashboardLayout>
  );
}

function ActionCard({
  href, icon, title, description,
}: {
  href: string; icon: string; title: string; description: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xl text-white shadow-md shadow-indigo-500/20">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A2E]">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">{description}</p>
      </div>
      <div className="mt-auto flex items-center gap-2 text-sm font-medium text-indigo-500 transition-all group-hover:gap-3">
        <span>Y accéder</span>
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  );
}
