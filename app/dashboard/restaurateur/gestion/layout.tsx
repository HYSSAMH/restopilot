"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const TABS = [
  { href: "/dashboard/restaurateur/gestion/achats",       label: "Historique d'achats" },
  { href: "/dashboard/restaurateur/gestion/prix",         label: "Analyse des prix"    },
  { href: "/dashboard/restaurateur/gestion/fournisseurs", label: "Fournisseurs"        },
  { href: "/dashboard/restaurateur/gestion/budget",       label: "Budget"              },
];

export default function GestionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
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

        {children}
      </div>
    </DashboardLayout>
  );
}
