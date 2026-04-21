"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";

type Role = "restaurateur" | "fournisseur";

const LINKS: Record<Role, { label: string; href: string; icon: React.ReactNode }[]> = {
  restaurateur: [
    { label: "Passer une commande", href: "/dashboard/restaurateur/commandes",  icon: <IconCart /> },
    { label: "À réceptionner",      href: "/dashboard/restaurateur/receptions", icon: <IconTruck /> },
    { label: "Mes commandes",       href: "/dashboard/restaurateur/historique", icon: <IconList /> },
    { label: "Factures",            href: "/dashboard/restaurateur/factures",   icon: <IconInvoice /> },
    { label: "Fournisseurs externes", href: "/dashboard/restaurateur/fournisseurs-externes", icon: <IconTruck /> },
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

  const rawRole      = roleOverride ?? profile?.role ?? "restaurateur";
  const role: Role   = rawRole === "admin" ? "restaurateur" : rawRole;
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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col",
          "border-r border-[#E5E7EB] bg-white",
          "transform transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:translate-x-0",
        ].join(" ")}
      >
      {/* Logo */}
      <Link
        href={homeHref}
        onClick={closeOnMobile}
        className="flex items-center gap-2.5 px-5 pt-5 pb-4"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
          <span className="text-base">🍽️</span>
        </div>
        <span className="text-[15px] font-semibold text-[#1A1A2E]">
          Resto<span className="text-indigo-500">Pilot</span>
        </span>
      </Link>

      {/* User chip */}
      <Link
        href="/profile"
        onClick={closeOnMobile}
        className="mx-3 mb-4 flex min-h-[44px] items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5 transition-colors hover:bg-[#F1F3F5]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
          {avatarLetter}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[#1A1A2E]">{entityName}</p>
          <p className="truncate text-[10px] uppercase tracking-wider text-[#6B7280]">
            {role === "fournisseur" ? "Distributeur" : "Restaurateur"}
          </p>
        </div>
      </Link>

      {/* Section "Menu" */}
      <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
        Menu
      </p>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={closeOnMobile}
              className={`group flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-[#6B7280] hover:bg-[#F1F3F5] hover:text-[#1A1A2E]"
              }`}
            >
              <span className={active ? "text-indigo-500" : "text-[#9CA3AF] group-hover:text-[#6B7280]"}>
                {l.icon}
              </span>
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Besoin d'aide */}
      <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 p-4 text-white">
        <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
          <span className="text-sm">💬</span>
        </div>
        <p className="text-sm font-semibold leading-tight">Besoin d&apos;aide ?</p>
        <p className="mt-1 text-[11px] text-white/80">
          Contactez notre équipe pour toute question.
        </p>
        <a
          href="mailto:support@restopilot.fr"
          className="mt-2.5 inline-block rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        >
          Écrire au support
        </a>
      </div>

      {/* Logout */}
      <div className="border-t border-[#E5E7EB] px-3 py-3">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
