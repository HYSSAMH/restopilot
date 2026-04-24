"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Icon, type IconName } from "@/components/ui/Icon";

const TABS: { href: string; label: string; icon: IconName; match: "exact" | "prefix" }[] = [
  { href: "/dashboard/restaurateur/menu", label: "Mes plats", icon: "chef-hat", match: "exact" },
  { href: "/dashboard/restaurateur/menu/rapport", label: "Rapport marge", icon: "trending-up", match: "prefix" },
  { href: "/dashboard/restaurateur/menu/mercuriale", label: "Ma mercuriale", icon: "book-open", match: "prefix" },
];

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isFiche = /^\/dashboard\/restaurateur\/menu\/[^/]+$/.test(pathname)
    && !TABS.some(t => pathname === t.href);

  return (
    <DashboardLayout role="restaurateur">
      {!isFiche && (
        <div className="mb-6">
          <header className="mb-6">
            <h1 className="page-title">Espace menu</h1>
            <p className="page-sub">Fiches techniques, marges et mercuriale consolidée.</p>
          </header>
          <nav
            role="tablist"
            className="inline-flex gap-[2px] p-1 bg-[var(--bg-subtle)] rounded-[9px] w-fit max-w-full overflow-x-auto"
          >
            {TABS.map(t => {
              const active = t.match === "exact"
                ? pathname === t.href
                : pathname === t.href || pathname.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  role="tab"
                  aria-selected={active}
                  className={[
                    "shrink-0 inline-flex items-center gap-[6px] px-[14px] py-[7px] rounded-[6px]",
                    "text-[12.5px] font-semibold transition-all duration-[120ms]",
                    active
                      ? "bg-white text-[var(--text)] shadow-[var(--elev-1)]"
                      : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
                  ].join(" ")}
                >
                  <Icon name={t.icon} size={14} />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      {children}
    </DashboardLayout>
  );
}
