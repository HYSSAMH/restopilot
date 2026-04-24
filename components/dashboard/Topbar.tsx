"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export interface TopbarProps {
  crumbs?: { label: ReactNode; href?: string }[];
  actions?: ReactNode;
  hasNotification?: boolean;
  onSearch?: (value: string) => void;
  onOpenMenu?: () => void;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  restaurateur: "Restaurateur",
  fournisseur: "Fournisseur",
  employe: "Employé",
  commandes: "Commandes",
  receptions: "Réceptions",
  historique: "Historique",
  factures: "Factures",
  "fournisseurs-externes": "Fournisseurs externes",
  menu: "Menu",
  mercuriale: "Mercuriale",
  rapport: "Rapport de marge",
  gestion: "Gestion",
  achats: "Historique achats",
  prix: "Analyse des prix",
  budget: "Budget",
  tresorerie: "Trésorerie",
  fournisseurs: "Fournisseurs",
  "saisie-ca": "Saisir mon CA",
  equipe: "Équipe",
  rapports: "Rapports",
  profile: "Mon profil",
  admin: "Admin",
  avoirs: "Avoirs",
  clients: "Clients",
};

function deriveCrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return [{ label: "Accueil" }];
  return segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = ROUTE_LABELS[seg] ?? seg.replace(/-/g, " ");
    const isLast = i === segments.length - 1;
    return { label, href: isLast ? undefined : href };
  });
}

export function Topbar({ crumbs, actions, hasNotification, onSearch, onOpenMenu }: TopbarProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const resolvedCrumbs = useMemo(() => crumbs ?? deriveCrumbs(pathname), [crumbs, pathname]);

  return (
    <header
      className="sticky top-0 z-[30] h-14 border-b border-[var(--border)] backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.85)" }}
    >
      <div className="flex h-full items-center gap-3 px-6">
        {/* Hamburger mobile */}
        {onOpenMenu ? (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Ouvrir le menu"
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-[7px] text-[var(--text)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Icon name="menu" size={18} />
          </button>
        ) : null}

        {/* Breadcrumbs */}
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-[13px] text-[var(--text-muted)] min-w-0">
          {resolvedCrumbs.map((c, i) => {
            const isLast = i === resolvedCrumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-2 min-w-0">
                {i > 0 && <Icon name="chevron-right" size={14} className="opacity-50 flex-shrink-0" />}
                {c.href && !isLast ? (
                  <Link
                    href={c.href}
                    className="hover:text-[var(--text)] transition-colors truncate"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast
                        ? "text-[var(--text)] font-[550] truncate"
                        : "truncate"
                    }
                  >
                    {c.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-[6px]">
          {/* Search box */}
          <label className="hidden md:flex items-center gap-2 h-9 px-[10px] w-[220px] bg-[var(--bg-subtle)] border border-transparent rounded-[8px] transition-[background,border-color,box-shadow] duration-[150ms] focus-within:bg-white focus-within:border-[var(--accent-border)] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]">
            <Icon name="search" size={14} className="text-[var(--text-subtle)] flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              placeholder="Rechercher produits, commandes…"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--text)] placeholder:text-[var(--text-subtle)] min-w-0"
            />
            <kbd className="mono text-[10.5px] px-[5px] py-[1px] rounded-[4px] bg-white border border-[var(--border)] text-[var(--text-muted)] whitespace-nowrap">
              ⌘K
            </kbd>
          </label>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-[7px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)] transition-colors"
          >
            <Icon name="bell" size={15} />
            {hasNotification ? (
              <span
                aria-hidden="true"
                className="absolute top-[9px] right-[9px] w-[7px] h-[7px] rounded-full bg-[var(--danger)] ring-2 ring-white"
              />
            ) : null}
          </button>

          {actions}
        </div>
      </div>
    </header>
  );
}
