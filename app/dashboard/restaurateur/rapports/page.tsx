"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";

interface Ligne {
  nom_snapshot: string;
  prix_snapshot: number;
  unite: string;
  quantite: number;
  date: string;
  fournisseur_id: string;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map(r => r.map(c => {
      const s = String(c);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RapportsPage() {
  const [lignes, setLignes]         = useState<Ligne[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState<"30" | "90" | "365" | "all">("90");
  const [selectedProduit, setSelectedProduit] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Récupère toutes les lignes de commandes du restaurateur
      const { data } = await supabase
        .from("commandes")
        .select(`
          fournisseur_id, created_at, statut,
          lignes_commande ( nom_snapshot, prix_snapshot, unite, quantite )
        `)
        .eq("restaurateur_id", user.id)
        .neq("statut", "annulee")
        .order("created_at", { ascending: true })
        .limit(2000);

      const flat: Ligne[] = [];
      (data ?? []).forEach((c: {
        fournisseur_id: string;
        created_at: string;
        lignes_commande: { nom_snapshot: string; prix_snapshot: number; unite: string; quantite: number }[];
      }) => {
        c.lignes_commande.forEach(l => {
          flat.push({
            nom_snapshot:   l.nom_snapshot,
            prix_snapshot:  Number(l.prix_snapshot),
            unite:          l.unite,
            quantite:       Number(l.quantite),
            date:           c.created_at,
            fournisseur_id: c.fournisseur_id,
          });
        });
      });
      setLignes(flat);

      const fournIds = Array.from(new Set(flat.map(l => l.fournisseur_id)));
      if (fournIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nom_commercial, nom_etablissement")
          .in("id", fournIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach(p => {
          map[p.id] = p.nom_commercial || p.nom_etablissement || "—";
        });
        setFournNames(map);
      }

      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (period === "all") return lignes;
    const days = parseInt(period, 10);
    const ref = new Date();
    ref.setDate(ref.getDate() - days);
    const iso = ref.toISOString();
    return lignes.filter(l => l.date >= iso);
  }, [lignes, period]);

  // Top produits
  const topParValeur = useMemo(() => {
    const map = new Map<string, { nom: string; valeur: number; qte: number }>();
    filtered.forEach(l => {
      const k = l.nom_snapshot.toLowerCase().trim();
      if (!map.has(k)) map.set(k, { nom: l.nom_snapshot, valeur: 0, qte: 0 });
      const e = map.get(k)!;
      e.valeur += l.prix_snapshot * l.quantite;
      e.qte    += l.quantite;
    });
    return Array.from(map.values()).sort((a, b) => b.valeur - a.valeur).slice(0, 10);
  }, [filtered]);

  const topParVolume = useMemo(() => {
    return [...topParValeur].sort((a, b) => b.qte - a.qte);
  }, [topParValeur]);

  // Économies (comparaison vs prix max observé sur le même produit/unité)
  const economies = useMemo(() => {
    let total = 0;
    const maxPrixParProduit = new Map<string, number>();
    filtered.forEach(l => {
      const k = l.nom_snapshot.toLowerCase().trim() + "_" + l.unite;
      maxPrixParProduit.set(k, Math.max(maxPrixParProduit.get(k) ?? 0, l.prix_snapshot));
    });
    filtered.forEach(l => {
      const k = l.nom_snapshot.toLowerCase().trim() + "_" + l.unite;
      const max = maxPrixParProduit.get(k) ?? l.prix_snapshot;
      total += (max - l.prix_snapshot) * l.quantite;
    });
    return total;
  }, [filtered]);

  // Évolution prix du produit sélectionné
  const evolutionPrix = useMemo(() => {
    if (!selectedProduit) return [];
    const k = selectedProduit.toLowerCase().trim();
    return filtered
      .filter(l => l.nom_snapshot.toLowerCase().trim() === k)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered, selectedProduit]);

  // Comparaison par fournisseur pour le produit sélectionné
  const parFournisseur = useMemo(() => {
    if (!selectedProduit) return [];
    const k = selectedProduit.toLowerCase().trim();
    const map = new Map<string, { id: string; prixMoyen: number; prixMin: number; prixMax: number; nb: number }>();
    filtered
      .filter(l => l.nom_snapshot.toLowerCase().trim() === k)
      .forEach(l => {
        if (!map.has(l.fournisseur_id)) {
          map.set(l.fournisseur_id, { id: l.fournisseur_id, prixMoyen: 0, prixMin: Infinity, prixMax: 0, nb: 0 });
        }
        const e = map.get(l.fournisseur_id)!;
        e.prixMoyen = (e.prixMoyen * e.nb + l.prix_snapshot) / (e.nb + 1);
        e.prixMin   = Math.min(e.prixMin, l.prix_snapshot);
        e.prixMax   = Math.max(e.prixMax, l.prix_snapshot);
        e.nb += 1;
      });
    return Array.from(map.values()).sort((a, b) => a.prixMoyen - b.prixMoyen);
  }, [filtered, selectedProduit]);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Produit", "Fournisseur", "Quantité", "Unité", "Prix unitaire", "Total"],
      ...filtered.map(l => [
        new Date(l.date).toLocaleDateString("fr-FR"),
        l.nom_snapshot,
        fournNames[l.fournisseur_id] ?? "—",
        l.quantite,
        l.unite,
        l.prix_snapshot.toFixed(2),
        (l.prix_snapshot * l.quantite).toFixed(2),
      ]),
    ];
    downloadCsv(`rapport-achats-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const maxValeur = topParValeur[0]?.valeur ?? 1;
  const maxVolume = topParVolume[0]?.qte ?? 1;

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Rapports d&apos;achats</span>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Rapports d&apos;achats</h1>
            <p className="page-sub">
              Basé sur <span className="mono">{filtered.length}</span> ligne{filtered.length > 1 ? "s" : ""} de commandes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as typeof period)}
              className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
            >
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">12 derniers mois</option>
              <option value="all">Tout l&apos;historique</option>
            </select>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
            >
              ↓ Export CSV
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi label="Volume total"
               value={fmt(filtered.reduce((s, l) => s + l.prix_snapshot * l.quantite, 0))} />
          <Kpi label="Produits uniques"
               value={new Set(filtered.map(l => l.nom_snapshot.toLowerCase().trim())).size.toString()} />
          <Kpi label="Économies estimées"
               value={fmt(economies)}
               sub="vs prix max observé sur le produit"
               accent="emerald" />
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
            Aucune commande sur la période sélectionnée.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Top par valeur + volume */}
            <div className="grid gap-4 lg:grid-cols-2">
              <TopCard
                title="Top 10 par valeur"
                items={topParValeur.map(p => ({ nom: p.nom, value: p.valeur, display: fmt(p.valeur), max: maxValeur, onClick: () => setSelectedProduit(p.nom) }))}
              />
              <TopCard
                title="Top 10 par volume"
                items={topParVolume.map(p => ({ nom: p.nom, value: p.qte, display: `${p.qte}`, max: maxVolume, onClick: () => setSelectedProduit(p.nom) }))}
              />
            </div>

            {/* Sélecteur produit + évolution */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[#1A1A2E]">Évolution &amp; comparaison</h2>
              <p className="mt-1 text-xs text-gray-500">
                Sélectionnez un produit pour voir l&apos;évolution de son prix et la comparaison par fournisseur.
              </p>
              <select
                value={selectedProduit ?? ""}
                onChange={e => setSelectedProduit(e.target.value || null)}
                className="mt-3 min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option value="">— Choisir un produit —</option>
                {topParValeur.map(p => (
                  <option key={p.nom} value={p.nom}>{p.nom}</option>
                ))}
              </select>

              {selectedProduit && (
                <>
                  {/* Comparaison par fournisseur */}
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Comparaison par fournisseur
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full min-w-[500px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2 text-left">Fournisseur</th>
                            <th className="px-3 py-2 text-right">Prix moyen</th>
                            <th className="px-3 py-2 text-right">Min</th>
                            <th className="px-3 py-2 text-right">Max</th>
                            <th className="px-3 py-2 text-right">Nb achats</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parFournisseur.map((p, i) => (
                            <tr key={p.id} className={i === 0 ? "bg-emerald-50" : ""}>
                              <td className="px-3 py-2 font-medium text-[#1A1A2E]">
                                {fournNames[p.id] ?? "—"}
                                {i === 0 && <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Meilleur</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-[#1A1A2E]">{fmt(p.prixMoyen)}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{fmt(p.prixMin)}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{fmt(p.prixMax)}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{p.nb}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Évolution prix (vue simple) */}
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Évolution du prix
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full min-w-[500px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Fournisseur</th>
                            <th className="px-3 py-2 text-right">Prix unit.</th>
                            <th className="px-3 py-2 text-right">Qté</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {evolutionPrix.map((l, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-gray-500">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                              <td className="px-3 py-2 text-[#1A1A2E]">{fournNames[l.fournisseur_id] ?? "—"}</td>
                              <td className="px-3 py-2 text-right font-semibold text-[#1A1A2E]">{fmt(l.prix_snapshot)}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{l.quantite}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" }) {
  const border = accent === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white";
  const txt    = accent === "emerald" ? "text-emerald-700" : "text-[#1A1A2E]";
  return (
    <div className={`rounded-2xl border ${border} p-5 shadow-sm`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1.5 text-xl font-bold ${txt}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

function TopCard({
  title, items,
}: {
  title: string;
  items: { nom: string; value: number; display: string; max: number; onClick?: () => void }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#1A1A2E]">{title}</h3>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((it, i) => {
          const pct = Math.round((it.value / it.max) * 100);
          return (
            <button
              key={it.nom}
              onClick={it.onClick}
              className="group flex flex-col gap-1 rounded-xl border border-transparent bg-gray-50 px-3 py-2 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 truncate text-sm font-medium text-[#1A1A2E]">
                  <span className="w-5 shrink-0 text-xs text-gray-400">#{i + 1}</span>
                  <span className="truncate">{it.nom}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-[#1A1A2E]">{it.display}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
