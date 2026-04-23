"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useProfile } from "@/lib/auth/use-profile";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";

export default function FournisseurHome() {
  const { profile } = useProfile();
  const firstName = profile?.prenom || profile?.nom_commercial || profile?.nom_etablissement || "";

  const [avoirsEnAttente, setAvoirsEnAttente] = useState<{ count: number; total: number } | null>(null);
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("commandes")
        .select("avoir_montant")
        .eq("fournisseur_id", profile.id)
        .eq("avoir_statut", "en_attente");
      if (data) {
        setAvoirsEnAttente({
          count: data.length,
          total: data.reduce((s, c) => s + Number(c.avoir_montant ?? 0), 0),
        });
      }
    })();
  }, [profile?.id]);

  return (
    <DashboardLayout role="fournisseur">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">Bonjour{firstName ? ` ${firstName}` : ""}</h1>
            <p className="page-sub">Gérez votre mercuriale et traitez vos commandes.</p>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-[7px] text-[13px] font-[550] text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)]"
          >
            Mon profil
          </Link>
        </div>

        {/* Bandeau avoirs en attente */}
        {avoirsEnAttente && avoirsEnAttente.count > 0 && (
          <Link
            href="/dashboard/fournisseur/avoirs"
            className="mb-4 flex items-center gap-3 rounded-[12px] border border-[var(--warning-soft)] bg-[var(--warning-soft)] p-4 transition-colors hover:brightness-95"
          >
            <span className="rp-status-dot pulse" style={{ color: "var(--warning)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-[600] text-[#B45309]">
                <span className="mono">{avoirsEnAttente.count}</span> avoir{avoirsEnAttente.count > 1 ? "s" : ""} en attente · <span className="mono">{avoirsEnAttente.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
              </p>
              <p className="mt-0.5 text-[12px] text-[#92400E]">
                Des restaurateurs ont signalé des anomalies de réception. Validez ou contestez ces avoirs.
              </p>
            </div>
            <span className="shrink-0 text-[var(--warning)]">→</span>
          </Link>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            href="/dashboard/fournisseur/mercuriale"
            iconName="package"
            title="Ma mercuriale"
            description="Ajoutez, modifiez ou importez vos produits et tarifs."
          />
          <ActionCard
            href="/dashboard/fournisseur/commandes"
            iconName="inbox"
            title="Mes commandes reçues"
            description="Suivez et mettez à jour le statut des commandes des restaurateurs."
          />
        </div>

        <Link
          href="/profile"
          className="mt-5 flex items-center gap-4 rounded-[12px] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-4 transition-colors hover:brightness-95"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-[8px] text-white"
            style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" }}
          >
            <Icon name="user" size={18} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-[600] tracking-[-0.01em] text-[var(--text)]">Complétez votre profil</p>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
              SIRET, IBAN, zone de livraison, horaires — apparaît sur les factures envoyées aux restaurateurs.
            </p>
          </div>
          <Icon name="arrow-right" size={16} className="shrink-0 text-[var(--accent)]" />
        </Link>
      </div>
    </DashboardLayout>
  );
}

function ActionCard({
  href, iconName, title, description,
}: {
  href: string;
  iconName: "package" | "inbox";
  title: string; description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-[12px] border border-[var(--border)] bg-white p-5 transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--bg-subtle)]"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-[8px] text-white"
        style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" }}
      >
        <Icon name={iconName} size={18} />
      </div>
      <div>
        <h2 className="text-[15px] font-[650] tracking-[-0.01em] text-[var(--text)]">{title}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="mt-auto flex items-center gap-2 text-[12px] font-[550] text-[var(--accent)]">
        <span>Y accéder</span>
        <Icon name="arrow-right" size={12} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
