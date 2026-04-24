"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { Icon, type IconName } from "@/components/ui/Icon";

type Role = "restaurateur" | "fournisseur" | "admin" | "employe";
type SidebarRole = "restaurateur" | "fournisseur";

type NavEntry =
  | { section: string }
  | { id: string; label: string; href: string; icon: IconName; count?: number; countTone?: "neutral" | "danger" };

const NAV: Record<SidebarRole, NavEntry[]> = {
  restaurateur: [
    { section: "Principal" },
    { id: "dashboard", label: "Dashboard", href: "/dashboard/restaurateur", icon: "home" },
    { id: "order", label: "Passer une commande", href: "/dashboard/restaurateur/commandes", icon: "shopping-cart" },
    { id: "receive", label: "À réceptionner", href: "/dashboard/restaurateur/receptions", icon: "inbox" },
    { id: "orders", label: "Mes commandes", href: "/dashboard/restaurateur/historique", icon: "package" },
    { id: "invoices", label: "Factures", href: "/dashboard/restaurateur/factures", icon: "file-text" },
    { id: "suppliers-ext", label: "Fournisseurs externes", href: "/dashboard/restaurateur/fournisseurs-externes", icon: "truck" },
    { section: "Menu" },
    { id: "fiches", label: "Fiches techniques", href: "/dashboard/restaurateur/menu", icon: "chef-hat" },
    { id: "margin", label: "Rapport de marge", href: "/dashboard/restaurateur/menu/rapport", icon: "trending-up" },
    { id: "mercuriale", label: "Ma mercuriale", href: "/dashboard/restaurateur/menu/mercuriale", icon: "book-open" },
    { section: "Gestion" },
    { id: "history", label: "Historique achats", href: "/dashboard/restaurateur/gestion/achats", icon: "clock" },
    { id: "prices", label: "Analyse des prix", href: "/dashboard/restaurateur/gestion/prix", icon: "activity" },
    { id: "budget", label: "Budget", href: "/dashboard/restaurateur/gestion/budget", icon: "piggy-bank" },
    { id: "treso", label: "Trésorerie", href: "/dashboard/restaurateur/gestion/tresorerie", icon: "wallet" },
    { id: "suppliers", label: "Fournisseurs", href: "/dashboard/restaurateur/gestion/fournisseurs", icon: "building" },
    { id: "revenue", label: "Saisir mon CA", href: "/dashboard/restaurateur/gestion/saisie-ca", icon: "euro" },
    { section: "Équipe" },
    { id: "team", label: "Équipe", href: "/dashboard/restaurateur/equipe", icon: "users" },
    { id: "reports", label: "Rapports", href: "/dashboard/restaurateur/rapports", icon: "bar-chart-2" },
    { section: "Compte" },
    { id: "profile", label: "Mon profil", href: "/profile", icon: "user" },
  ],
  fournisseur: [
    { section: "Principal" },
    { id: "f-dashboard", label: "Dashboard", href: "/dashboard/fournisseur", icon: "home" },
    { id: "f-mercuriale", label: "Ma mercuriale", href: "/dashboard/fournisseur/mercuriale", icon: "book-open" },
    { id: "f-orders", label: "Mes commandes", href: "/dashboard/fournisseur/commandes", icon: "inbox" },
    { id: "f-clients", label: "Clients", href: "/dashboard/fournisseur/clients", icon: "users" },
    { id: "f-avoirs", label: "Avoirs", href: "/dashboard/fournisseur/avoirs", icon: "receipt" },
    { section: "Compte" },
    { id: "f-profile", label: "Mon profil", href: "/profile", icon: "user" },
  ],
};

interface SidebarProps {
  role?: Role;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ role: roleOverride, isOpen = false, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, displayName } = useProfile();
  const [loggingOut, setLoggingOut] = useState(false);

  const rawRole = roleOverride ?? profile?.role ?? "restaurateur";
  const role: SidebarRole = rawRole === "fournisseur" ? "fournisseur" : "restaurateur";
  const homeHref = `/dashboard/${role}`;
  const entityName = profile?.nom_commercial || profile?.nom_etablissement || displayName;
  const avatarLetters = (entityName || "?").slice(0, 2).toUpperCase();
  const userEmail = profile?.email || "";
  const userInitials = (displayName || profile?.email || "?").slice(0, 2).toUpperCase();
  const roleLabel = role === "fournisseur" ? "Distributeur" : "Restaurateur";

  const nav = NAV[role];
  const closeOnMobile = () => onClose?.();

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden animate-fade-in"
          onClick={closeOnMobile}
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        aria-label="Navigation principale"
        className={[
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[240px] shrink-0 flex-col",
          "border-r border-[var(--border)] bg-[var(--surface)]",
          "transform transition-transform duration-[200ms] ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:translate-x-0",
        ].join(" ")}
      >
        {/* Brand */}
        <Link
          href={homeHref}
          onClick={closeOnMobile}
          className="flex items-center gap-[10px] border-b border-[var(--border)] px-5 pt-[18px] pb-4"
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-white"
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
              boxShadow: "0 1px 2px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            RP
          </div>
          <span className="text-[15px] font-[650] tracking-[-0.015em] text-[var(--text)] flex-1">
            RestoPilot
          </span>
          <span className="text-[10px] px-[6px] py-[2px] rounded-[4px] bg-[var(--bg-subtle)] text-[var(--text-muted)] font-medium">
            v2
          </span>
        </Link>

        {/* Workspace pill */}
        <div className="border-b border-[var(--border)] p-3">
          <Link
            href="/profile"
            onClick={closeOnMobile}
            className="flex items-center gap-[10px] rounded-[8px] px-[10px] py-2 transition-colors hover:bg-[var(--bg-subtle)]"
          >
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] bg-[#1E293B] text-[11px] font-semibold text-white">
              {avatarLetters}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-[550] text-[var(--text)]">{entityName}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{roleLabel}</p>
            </div>
            <Icon name="chevron-down" size={14} className="text-[var(--text-subtle)] flex-shrink-0" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {nav.map((entry, i) => {
            if ("section" in entry) {
              return (
                <div
                  key={`s-${i}`}
                  className="px-[10px] pt-[10px] pb-1 text-[10.5px] font-[650] uppercase tracking-[0.08em] text-[var(--text-subtle)]"
                >
                  {entry.section}
                </div>
              );
            }
            const active = pathname === entry.href || pathname.startsWith(entry.href + "/");
            return (
              <Link
                key={entry.id}
                href={entry.href}
                onClick={closeOnMobile}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative mx-[2px] my-[1px] flex items-center gap-[10px]",
                  "rounded-[6px] px-[10px] py-[6px] text-[13px]",
                  "transition-[background,color] duration-[120ms]",
                  active
                    ? "bg-[var(--accent-soft)] font-[550] text-[var(--accent)]"
                    : "font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
                ].join(" ")}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-[2px] bg-[var(--accent)]"
                  />
                )}
                <Icon
                  name={entry.icon}
                  size={16}
                  className={active ? "text-[var(--accent)]" : "text-[var(--text-subtle)]"}
                />
                <span className="flex-1 truncate">{entry.label}</span>
                {typeof entry.count === "number" ? (
                  <span
                    className={[
                      "mono tabular text-[10.5px] px-[6px] py-[1px] rounded-full font-medium",
                      entry.countTone === "danger"
                        ? "bg-[var(--danger)] text-white"
                        : active
                          ? "bg-white text-[var(--accent)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
                    ].join(" ")}
                  >
                    {entry.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Footer user */}
        <div className="border-t border-[var(--border)] p-[10px] flex items-center gap-[10px]">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-semibold"
            style={{ background: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)" }}
          >
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-[550] text-[var(--text)] truncate">{displayName}</p>
            {userEmail ? (
              <p className="text-[11px] text-[var(--text-muted)] truncate">{userEmail}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Se déconnecter"
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--danger)] transition-colors disabled:opacity-50"
          >
            <Icon name="log-out" size={15} />
          </button>
        </div>
      </aside>
    </>
  );
}
