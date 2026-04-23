"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

interface Props {
  children: React.ReactNode;
  role?: "restaurateur" | "fournisseur";
}

/**
 * Layout dashboard responsive :
 *   ≥ md : sidebar fixe à gauche + contenu à droite
 *   < md : sidebar masquée (slide-in sur ouverture via hamburger)
 */
export default function DashboardLayout({ children, role }: Props) {
  const [open, setOpen]   = useState(false);
  const pathname          = usePathname();

  // Ferme la sidebar à chaque changement de route (backup du onClick sur liens)
  useEffect(() => { setOpen(false); }, [pathname]);

  // Bloque le scroll du body quand la sidebar mobile est ouverte
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar role={role} isOpen={open} onClose={() => setOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile avec hamburger */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-white/85 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-11 w-11 items-center justify-center rounded-[7px] text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)]"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[11px] font-bold text-white"
              style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" }}
            >
              RP
            </div>
            <span className="text-[15px] font-[650] tracking-[-0.015em] text-[var(--text)]">
              RestoPilot
            </span>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
