"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { createClient } from "@/lib/supabase/client";
import type { StatutCommande } from "@/lib/supabase/types";

interface Row {
  id: string;
  restaurateur_id: string | null;
  restaurateur_nom: string;
  fournisseur_id: string;
  statut: StatutCommande;
  montant_total: number;
  created_at: string;
}

const STATUT_LABELS: Record<StatutCommande, string> = {
  recue:                       "Reçue",
  en_preparation:              "En préparation",
  en_livraison:                "En livraison",
  livree:                      "Livrée",
  receptionnee:                "Réceptionnée",
  receptionnee_avec_anomalies: "Récep. anomalies",
  annulee:                     "Annulée",
};
const STATUT_CHIP: Record<StatutCommande, string> = {
  recue:                       "border-amber-200 bg-amber-50 text-amber-700",
  en_preparation:              "border-blue-200 bg-blue-50 text-blue-700",
  en_livraison:                "border-violet-200 bg-violet-50 text-violet-700",
  livree:                      "border-sky-200 bg-sky-50 text-sky-700",
  receptionnee:                "border-emerald-200 bg-emerald-50 text-emerald-700",
  receptionnee_avec_anomalies: "border-rose-200 bg-rose-50 text-rose-700",
  annulee:                     "border-red-200 bg-red-50 text-red-700",
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

function CommandesInner() {
  const searchParams = useSearchParams();
  const userFilter   = searchParams.get("user");

  const [rows, setRows]     = useState<Row[]>([]);
  const [names, setNames]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState<"tous" | StatutCommande>("tous");
  const [filtreDate, setFiltreDate]     = useState<"tous" | "jour" | "semaine" | "mois">("tous");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      let q = supabase
        .from("commandes")
        .select("id, restaurateur_id, restaurateur_nom, fournisseur_id, statut, montant_total, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (userFilter) q = q.or(`restaurateur_id.eq.${userFilter},fournisseur_id.eq.${userFilter}`);

      const { data } = await q;
      const typed = (data ?? []) as Row[];
      setRows(typed);

      // Fetch profils des fournisseurs (les noms courants)
      const fournIds = Array.from(new Set(typed.map(r => r.fournisseur_id).filter(Boolean)));
      if (fournIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nom_commercial, nom_etablissement")
          .in("id", fournIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach(p => {
          map[p.id] = p.nom_commercial || p.nom_etablissement || "—";
        });
        setNames(map);
      }
      setLoading(false);
    })();
  }, [userFilter]);

  const filtered = useMemo(() => {
    let arr = rows;
    if (filtreStatut !== "tous") arr = arr.filter(r => r.statut === filtreStatut);
    if (filtreDate !== "tous") {
      const now = new Date();
      const threshold = new Date();
      if (filtreDate === "jour")    threshold.setHours(0, 0, 0, 0);
      if (filtreDate === "semaine") threshold.setDate(now.getDate() - 7);
      if (filtreDate === "mois")    threshold.setDate(now.getDate() - 30);
      const iso = threshold.toISOString();
      arr = arr.filter(r => r.created_at >= iso);
    }
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(r =>
        r.restaurateur_nom?.toLowerCase().includes(s) ||
        (names[r.fournisseur_id] ?? "").toLowerCase().includes(s),
      );
    }
    return arr;
  }, [rows, filtreStatut, filtreDate, search, names]);

  const totalVolume = filtered.filter(r => r.statut !== "annulee").reduce((s, r) => s + Number(r.montant_total), 0);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">Commandes</h1>
            <p className="mt-1 text-sm text-gray-500">
              {filtered.length} commande{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
              {userFilter && (
                <> · <Link href="/admin/commandes" className="text-indigo-500 hover:underline">voir tout</Link></>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Volume affiché</p>
            <p className="text-lg font-bold text-[#1A1A2E]">{fmt(totalVolume)}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (restaurateur ou fournisseur)"
            className="flex-1 min-w-48 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <select
            value={filtreStatut}
            onChange={e => setFiltreStatut(e.target.value as typeof filtreStatut)}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="tous">Tous statuts</option>
            {Object.entries(STATUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filtreDate}
            onChange={e => setFiltreDate(e.target.value as typeof filtreDate)}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="tous">Toutes dates</option>
            <option value="jour">Aujourd&apos;hui</option>
            <option value="semaine">7 derniers jours</option>
            <option value="mois">30 derniers jours</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
            Aucune commande ne correspond aux filtres.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Restaurateur</th>
                  <th className="px-5 py-3 text-left">Fournisseur</th>
                  <th className="px-5 py-3 text-left">Statut</th>
                  <th className="px-5 py-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(r.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-3">
                      {r.restaurateur_id ? (
                        <Link href={`/admin/users/${r.restaurateur_id}`} className="text-[#1A1A2E] hover:text-indigo-600">
                          {r.restaurateur_nom}
                        </Link>
                      ) : (
                        <span className="text-gray-500">{r.restaurateur_nom}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${r.fournisseur_id}`} className="text-[#1A1A2E] hover:text-indigo-600">
                        {names[r.fournisseur_id] ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUT_CHIP[r.statut]}`}>
                        {STATUT_LABELS[r.statut]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-[#1A1A2E]">{fmt(r.montant_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default function AdminCommandesPage() {
  return (
    <Suspense fallback={<AdminLayout><div className="p-10 text-gray-500">Chargement…</div></AdminLayout>}>
      <CommandesInner />
    </Suspense>
  );
}
