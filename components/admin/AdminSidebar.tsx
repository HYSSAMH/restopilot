"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";

const LINKS = [
  { label: "Vue d'ensemble", href: "/admin",           icon: <IconGrid />   },
  { label: "Utilisateurs",   href: "/admin/users",     icon: <IconUsers />  },
  { label: "Commandes",      href: "/admin/commandes", icon: <IconInbox />  },
  { label: "Avoirs & litiges", href: "/admin/avoirs",  icon: <IconAvoir />  },
  { label: "Test import",    href: "/admin/test-import", icon: <IconGrid />   },
];

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ isOpen = false, onClose }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName  = profile?.nom_commercial || profile?.nom_etablissement || profile?.email || "Admin";
  const avatarLetter = (displayName || "A").charAt(0).toUpperCase();

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
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={closeOnMobile} />
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
        <Link href="/admin" onClick={closeOnMobile} className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-sm">
            <span className="text-base">🛡️</span>
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[#1A1A2E] leading-none">
              Resto<span className="text-indigo-500">Pilot</span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-500">Admin</p>
          </div>
        </Link>

        {/* User chip */}
        <div className="mx-3 mb-4 flex min-h-[44px] items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 text-xs font-bold text-white">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#1A1A2E]">{displayName}</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-rose-500">Administrateur</p>
          </div>
        </div>

        {/* Nav */}
        <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Menu</p>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {LINKS.map((l) => {
            const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={closeOnMobile}
                className={`group flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-rose-50 text-rose-600"
                    : "text-[#6B7280] hover:bg-[#F1F3F5] hover:text-[#1A1A2E]"
                }`}
              >
                <span className={active ? "text-rose-500" : "text-[#9CA3AF] group-hover:text-[#6B7280]"}>
                  {l.icon}
                </span>
                <span>{l.label}</span>
              </Link>
            );
          })}
        </nav>

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

function IconGrid() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5zm10 0h6v6h-6V5zM4 13h6v6H4v-6zm10 0h6v6h-6v-6z" />
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
function IconInbox() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-5l-2 3h-2l-2-3H4" />
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
function IconAvoir() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4V4Zm4 5h8M8 12h5m-5 3h8" />
    </svg>
  );
}
