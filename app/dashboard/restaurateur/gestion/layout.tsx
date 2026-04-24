"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/Button";

const TABS = [
  { href: "/dashboard/restaurateur/gestion/achats", label: "Historique d'achats" },
  { href: "/dashboard/restaurateur/gestion/prix", label: "Analyse des prix" },
  { href: "/dashboard/restaurateur/gestion/fournisseurs", label: "Fournisseurs" },
  { href: "/dashboard/restaurateur/gestion/budget", label: "Budget" },
  { href: "/dashboard/restaurateur/gestion/tresorerie", label: "Trésorerie" },
];

const SAISIE_HREF = "/dashboard/restaurateur/gestion/saisie-ca";

export default function GestionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <DashboardLayout role="restaurateur">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Espace gestion</h1>
          <p className="page-sub">Pilotage achats, prix, budget et trésorerie.</p>
        </div>
        <Link href={SAISIE_HREF}>
          <Button variant="primary" iconLeft="euro">Saisir mon CA</Button>
        </Link>
      </header>

      {/* Sous-navigation : tabs pill inline */}
      <nav
        role="tablist"
        className="mb-6 inline-flex gap-[2px] p-1 bg-[var(--bg-subtle)] rounded-[9px] w-fit max-w-full overflow-x-auto"
      >
        {TABS.map(t => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active}
              className={[
                "shrink-0 inline-flex items-center px-[14px] py-[7px] rounded-[6px]",
                "text-[12.5px] font-semibold transition-all duration-[120ms]",
                active
                  ? "bg-white text-[var(--text)] shadow-[var(--elev-1)]"
                  : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </DashboardLayout>
  );
}
