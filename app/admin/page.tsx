"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { createClient } from "@/lib/supabase/client";

interface Stats {
  totalRestaurateurs: number;
  totalFournisseurs:  number;
  totalCommandes:     number;
  commandesJour:      number;
  volumeJour:         number;
  volumeTotal:        number;
}

function fmtEuro(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: profs } = await supabase
        .from("profiles").select("role");
      const { data: cmds } = await supabase
        .from("commandes").select("id, montant_total, created_at, statut");

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const s: Stats = {
        totalRestaurateurs: (profs ?? []).filter(p => p.role === "restaurateur").length,
        totalFournisseurs:  (profs ?? []).filter(p => p.role === "fournisseur").length,
        totalCommandes:     (cmds ?? []).length,
        commandesJour:      (cmds ?? []).filter(c => c.created_at >= todayIso).length,
        volumeJour:         (cmds ?? [])
                              .filter(c => c.created_at >= todayIso && c.statut !== "annulee")
                              .reduce((acc, c) => acc + Number(c.montant_total), 0),
        volumeTotal:        (cmds ?? [])
                              .filter(c => c.statut !== "annulee")
                              .reduce((acc, c) => acc + Number(c.montant_total), 0),
      };
      setStats(s);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Vue d&apos;ensemble</h1>
          <p className="mt-1 text-sm text-gray-500">
            État général de la plateforme en temps réel.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Restaurateurs"       value={stats?.totalRestaurateurs} loading={loading} />
          <Kpi label="Distributeurs"       value={stats?.totalFournisseurs}  loading={loading} />
          <Kpi label="Commandes aujourd'hui" value={stats?.commandesJour}    loading={loading} />
          <Kpi
            label="Volume aujourd'hui"
            value={stats ? fmtEuro(stats.volumeJour) : undefined}
            loading={loading}
            wide
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Kpi label="Volume total"   value={stats ? fmtEuro(stats.volumeTotal) : undefined} loading={loading} wide />
          <Kpi label="Total commandes" value={stats?.totalCommandes} loading={loading} />
          <div className="col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Raccourcis</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/admin/users"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#1A1A2E] transition-colors hover:border-indigo-300 hover:text-indigo-600"
              >
                → Gérer les utilisateurs
              </Link>
              <Link
                href="/admin/commandes"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#1A1A2E] transition-colors hover:border-indigo-300 hover:text-indigo-600"
              >
                → Voir toutes les commandes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Kpi({
  label, value, loading, wide,
}: { label: string; value?: number | string; loading?: boolean; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${wide ? "" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className="mt-1.5 text-2xl font-bold text-[#1A1A2E]">{value ?? "—"}</p>
      )}
    </div>
  );
}
