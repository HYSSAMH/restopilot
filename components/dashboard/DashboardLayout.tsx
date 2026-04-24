"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { Topbar } from "./Topbar";

interface Props {
  children: React.ReactNode;
  role?: "restaurateur" | "fournisseur";
  topbarActions?: React.ReactNode;
  hasNotification?: boolean;
  hideTopbar?: boolean;
}

/**
 * v2 shell : sidebar 240px + topbar 56px sticky backdrop-blur + content 1440px
 * Mobile : sidebar en drawer via hamburger dans la topbar.
 */
export default function DashboardLayout({
  children,
  role,
  topbarActions,
  hasNotification,
  hideTopbar = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (window.innerWidth >= 768) return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar role={role} isOpen={open} onClose={() => setOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col">
        {!hideTopbar ? (
          <Topbar
            actions={topbarActions}
            hasNotification={hasNotification}
            onOpenMenu={() => setOpen(true)}
          />
        ) : null}

        <div key={pathname} className="flex-1 animate-page-enter">
          <div className="mx-auto w-full max-w-[1440px] px-6 pt-6 pb-12 md:px-7 md:pt-6 md:pb-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
