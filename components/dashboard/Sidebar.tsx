"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";

type Role = "restaurateur" | "fournisseur" | "admin" | "employe";
type SidebarRole = "restaurateur" | "fournisseur";

const LINKS: Record<SidebarRole, { label: string; href: string; icon: React.ReactNode }[]> = {
  restaurateur: [
    { label: "Passer une commande", href: "/dashboard/restaurateur/commandes",  icon: <IconCart /> },
    { label: "À réceptionner",      href: "/dashboard/restaurateur/receptions", icon: <IconTruck /> },
    { label: "Mes commandes",       href: "/dashboard/restaurateur/historique", icon: <IconList /> },
    { label: "Factures",            href: "/dashboard/restaurateur/factures",   icon: <IconInvoice /> },
    { label: "Fournisseurs externes", href: "/dashboard/restaurateur/fournisseurs-externes", icon: <IconTruck /> },
    { label: "Menu",                href: "/dashboard/restaurateur/menu",       icon: <IconCatalog /> },
    { label: "Gestion",             href: "/dashboard/restaurateur/gestion",    icon: <IconChart /> },
    { label: "Équipe",              href: "/dashboard/restaurateur/equipe",     icon: <IconUsers /> },
    { label: "Mon profil",          href: "/profile",                           icon: <IconUser /> },
  ],
  fournisseur: [
    { label: "Ma mercuriale", href: "/dashboard/fournisseur/mercuriale", icon: <IconCatalog /> },
    { label: "Mes commandes", href: "/dashboard/fournisseur/commandes",  icon: <IconInbox /> },
    { label: "Clients",       href: "/dashboard/fournisseur/clients",    icon: <IconUsers /> },
    { label: "Avoirs",        href: "/dashboard/fournisseur/avoirs",     icon: <IconReceipt /> },
    { label: "Mon profil",    href: "/profile",                          icon: <IconUser /> },
  ],
};

interface SidebarProps {
  role?: Role;
  /** Ouvert sur mobile ? (ignoré en desktop, toujours visible). */
  isOpen?: boolean;
  /** Callback pour fermer (mobile uniquement). */
  onClose?: () => void;
}

export default function Sidebar({ role: roleOverride, isOpen = false, onClose }: SidebarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { profile, displayName } = useProfile();
  const [loggingOut, setLoggingOut] = useState(false);

  const rawRole         = roleOverride ?? profile?.role ?? "restaurateur";
  // Sidebar n'affiche que des liens restaurateur/fournisseur.
  // admin et employe sont repliés sur restaurateur par défaut — les
  // employés ont leur propre layout sans sidebar et l'admin utilise /admin.
  const role: SidebarRole = rawRole === "fournisseur" ? "fournisseur" : "restaurateur";
  const homeHref     = `/dashboard/${role}`;
  const entityName   = profile?.nom_commercial || profile?.nom_etablissement || displayName;
  const avatarLetter = (entityName || "?").charAt(0).toUpperCase();
  const links        = LINKS[role];

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
      {/* Backdrop (mobile uniquement, quand ouvert) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeOnMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[240px] shrink-0 flex-col",
          "border-r border-[var(--border)] bg-[var(--surface)]",
          "transform transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:translate-x-0",
        ].join(" ")}
      >
      {/* Brand : RP mark + nom + badge version */}
      <Link
        href={homeHref}
        onClick={closeOnMobile}
        className="flex items-center gap-2.5 border-b border-[var(--border)] px-5 py-[18px]"
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
        <span className="text-[15px] font-[650] tracking-[-0.015em] text-[var(--text)]">
          RestoPilot
        </span>
      </Link>

      {/* Workspace pill (profil courant du restaurateur / fournisseur) */}
      <div className="border-b border-[var(--border)] p-3">
        <Link
          href="/profile"
          onClick={closeOnMobile}
          className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 transition-colors hover:bg-[var(--bg-subtle)]"
        >
          <div
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] bg-[#1E293B] text-[11px] font-semibold text-white"
          >
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-[550] text-[var(--text)]">{entityName}</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {role === "fournisseur" ? "Distributeur" : "Restaurateur"}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-[650] uppercase tracking-[0.04em] text-[var(--text-subtle)]">
          Menu
        </div>
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={closeOnMobile}
              className={`relative mx-0.5 my-[1px] flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] font-[550] text-[var(--accent)]"
                  : "font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
              }`}
            >
              <span className={`${active ? "text-[var(--accent)]" : "text-[var(--text-subtle)]"} [&>svg]:h-4 [&>svg]:w-4`}>
                {l.icon}
              </span>
              <span className="flex-1 truncate">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer : logout */}
      <div className="border-t border-[var(--border)] p-2.5">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4"
        >
          <IconLogout />
          <span>{loggingOut ? "Déconnexion…" : "Se déconnecter"}</span>
        </button>
      </div>
    </aside>
    </>
  );
}

// ── Icônes (stroke 1.6, heroicons style) ──────────────────────────────────

function IconCart() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6c-.3.7.2 1.4.9 1.4H19M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  );
}
function IconList() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01" />
    </svg>
  );
}
function IconCatalog() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-5l-2 3h-2l-2-3H4" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-8 6a6 6 0 0 0-6 6v1h20v-1a6 6 0 0 0-6-6H8Z" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v8H3V7Zm11 3h4l3 3v2h-7v-5Zm-7 7a2 2 0 1 1 0 0.01M16 17a2 2 0 1 1 0 0.01" />
    </svg>
  );
}
function IconInvoice() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2V5a2 2 0 0 0-2-2Zm-7 8h6m-6 4h6" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m6 10V4m6 16v-8m4 8H2" />
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3Zm2 6h8m-8 4h8m-8 4h4" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4 10v1H4v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6Z" />
    </svg>
  );
}
