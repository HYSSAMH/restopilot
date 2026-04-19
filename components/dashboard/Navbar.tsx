"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";

type Role = "restaurateur" | "fournisseur";

interface NavbarProps {
  /** Si fourni, override le rôle détecté depuis la session (utile pour les pages à rôle fixe). */
  role?: Role;
}

const navLinks: Record<Role, { label: string; href: string }[]> = {
  restaurateur: [
    { label: "Passer une commande", href: "/dashboard/restaurateur/commandes"  },
    { label: "Mes commandes",       href: "/dashboard/restaurateur/historique" },
  ],
  fournisseur: [
    { label: "Ma mercuriale",       href: "/dashboard/fournisseur/mercuriale" },
    { label: "Mes commandes",       href: "/dashboard/fournisseur/commandes"  },
  ],
};

export default function Navbar({ role: roleOverride }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);

  const role         = roleOverride ?? profile?.role ?? "restaurateur";
  const displayName  = [profile?.prenom, profile?.nom].filter(Boolean).join(" ")
                      || profile?.nom_etablissement
                      || "Mon compte";
  const entityName   = profile?.nom_etablissement
                      ?? (role === "fournisseur" ? "Mon activité" : "Mon restaurant");
  const avatarLetter = (profile?.prenom ?? profile?.nom_etablissement ?? "?").charAt(0).toUpperCase();

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0d0d1a]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-500">
            <span className="text-sm">{role === "fournisseur" ? "🚚" : "🍽️"}</span>
          </div>
          <span className="font-bold text-white">
            Resto<span className="text-violet-400">Pilot</span>
          </span>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          <span className="hidden text-sm text-white/40 sm:block">{entityName}</span>
        </div>

        {/* Nav links */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks[role].map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition-colors hover:bg-white/8"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-500 text-xs font-bold">
              {avatarLetter}
            </div>
            <span className="hidden text-white/70 sm:block">{displayName}</span>
            <svg className={`h-4 w-4 text-white/30 transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <>
              {/* backdrop to close on outside click */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-white/10 bg-[#13132a] py-1 shadow-xl shadow-black/40">
                {profile && (
                  <div className="border-b border-white/8 px-4 py-2.5">
                    <p className="truncate text-sm font-medium text-white">{displayName}</p>
                    <p className="truncate text-xs text-white/40">{profile.email}</p>
                    <p className="mt-1 inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                      {role === "fournisseur" ? "Fournisseur" : "Restaurateur"}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  <span>🚪</span> {loggingOut ? "Déconnexion…" : "Se déconnecter"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
