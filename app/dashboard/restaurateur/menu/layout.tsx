"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const TABS = [
  { href: "/dashboard/restaurateur/menu",            label: "🍽️ Mes plats",       match: "exact" as const },
  { href: "/dashboard/restaurateur/menu/rapport",    label: "📊 Rapport marge",    match: "prefix" as const },
  { href: "/dashboard/restaurateur/menu/mercuriale", label: "🛒 Ma mercuriale",    match: "prefix" as const },
];

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Masque la barre d'onglets sur les fiches individuelles (/menu/[plat_id])
  // → l'URL a un segment dynamique qui n'est pas un des tabs connus
  const isFiche = /^\/dashboard\/restaurateur\/menu\/[^/]+$/.test(pathname)
               && !TABS.some(t => pathname === t.href);

  return (
    <DashboardLayout role="restaurateur">
      {!isFiche && (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8 sm:pt-10">
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
            <span>/</span>
            <span className="text-gray-600">Menu</span>
          </div>
          <h1 className="mb-6 text-2xl font-bold text-[#1A1A2E]">Espace menu</h1>
          <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
            {TABS.map(t => {
              const active = t.match === "exact"
                ? pathname === t.href
                : pathname === t.href || pathname.startsWith(t.href + "/");
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
        </div>
      )}
      {children}
    </DashboardLayout>
  );
}
