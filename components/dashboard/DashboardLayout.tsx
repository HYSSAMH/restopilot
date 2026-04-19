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
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <Sidebar role={role} isOpen={open} onClose={() => setOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile avec hamburger */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[#1A1A2E] transition-colors hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="text-base font-semibold text-[#1A1A2E]">
            Resto<span className="text-indigo-500">Pilot</span>
          </span>
        </div>

        {/* Contenu */}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
