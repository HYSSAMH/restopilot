"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <AdminSidebar isOpen={open} onClose={() => setOpen(false)} />
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[#1A1A2E] hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="text-base font-semibold text-[#1A1A2E]">
            Resto<span className="text-indigo-500">Pilot</span>
            <span className="ml-1.5 text-xs uppercase tracking-wider text-rose-500">Admin</span>
          </span>
        </div>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
