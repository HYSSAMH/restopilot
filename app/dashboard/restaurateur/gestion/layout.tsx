"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const TABS = [
  { href: "/dashboard/restaurateur/gestion/achats",       label: "Historique d'achats" },
  { href: "/dashboard/restaurateur/gestion/prix",         label: "Analyse des prix"    },
  { href: "/dashboard/restaurateur/gestion/fournisseurs", label: "Fournisseurs"        },
  { href: "/dashboard/restaurateur/gestion/budget",       label: "Budget"              },
  { href: "/dashboard/restaurateur/gestion/tresorerie",   label: "Trésorerie"          },
];

const SAISIE_HREF = "/dashboard/restaurateur/gestion/saisie-ca";

export default function GestionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const saisieActive = pathname === SAISIE_HREF || pathname.startsWith(SAISIE_HREF + "/");
  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Gestion</span>
        </div>

        <h1 className="mb-6 text-2xl font-bold text-[#1A1A2E]">Espace gestion</h1>

        {/* Sous-navigation */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
            {TABS.map(t => {
              const active = pathname === t.href || pathname.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`min-h-[40px] shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-indigo-500 text-white" : "text-gray-500 hover:text-[#1A1A2E]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {/* Bouton de saisie : visuellement distinct des onglets */}
          <Link
            href={SAISIE_HREF}
            className={`ml-0 flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold shadow-md transition-all sm:ml-1 ${
              saisieActive
                ? "bg-[#1A1A2E] text-white shadow-black/20"
                : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-indigo-500/25 hover:opacity-95"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
            <span>Saisir mon CA</span>
          </Link>
        </div>

        {children}
      </div>
    </DashboardLayout>
  );
}
