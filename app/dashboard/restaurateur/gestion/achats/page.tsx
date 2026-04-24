"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { loadRestaurateurData, montantNet, fmt, downloadCsv, fournIdOf, CAT_LABELS, type Commande } from "@/lib/gestion-data";

type Period = "jour" | "7j" | "30j" | "3m" | "1an" | "tous" | "perso";

interface Ligne {
  date:          string;
  produit:       string;
  fournNom:      string;
  fournId:       string;
  categorie:     string;
  quantite:      number;
  unite:         string;
  prix_unitaire: number;
  total:         number;
}

function periodRange(p: Period, persoFrom: string, persoTo: string): [Date, Date] | null {
  const now = new Date();
  if (p === "tous") return null;
  if (p === "perso") {
    if (!persoFrom || !persoTo) return null;
    return [new Date(persoFrom), new Date(persoTo + "T23:59:59")];
  }
  const from = new Date();
  if (p === "jour") from.setHours(0, 0, 0, 0);
  if (p === "7j")   from.setDate(from.getDate() - 7);
  if (p === "30j")  from.setDate(from.getDate() - 30);
  if (p === "3m")   from.setMonth(from.getMonth() - 3);
  if (p === "1an")  from.setFullYear(from.getFullYear() - 1);
  return [from, now];
}

export default function AchatsPage() {
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);

  const [period, setPeriod]     = useState<Period>("30j");
  const [persoFrom, setPFrom]   = useState("");
  const [persoTo, setPTo]       = useState("");
  const [fournFilter, setFF]    = useState("tous");
  const [categFilter, setCF]    = useState("tous");
  const [produitSearch, setPS]  = useState("");

  useEffect(() => {
    (async () => {
      const d = await loadRestaurateurData();
      setCommandes(d.commandes);
      setFournNames(d.fournNames);
      setCategories(d.categories);
      setLoading(false);
    })();
  }, []);

  // Flatten en lignes + applique filtres
  const lignes: Ligne[] = useMemo(() => {
    const range = periodRange(period, persoFrom, persoTo);
    const out: Ligne[] = [];
    for (const c of commandes) {
      if (c.statut === "annulee") continue;
      const d = new Date(c.created_at);
      if (range && (d < range[0] || d > range[1])) continue;
      const fId  = fournIdOf(c);
      const fNom = fournNames[fId] ?? "—";
      if (fournFilter !== "tous" && fId !== fournFilter) continue;
      for (const l of c.lignes_commande) {
        const cat = categories[l.nom_snapshot] ?? "epicerie";
        if (categFilter !== "tous" && cat !== categFilter) continue;
        if (produitSearch && !l.nom_snapshot.toLowerCase().includes(produitSearch.toLowerCase())) continue;
        out.push({
          date:          c.created_at,
          produit:       l.nom_snapshot,
          fournNom:      fNom,
          fournId:       fId,
          categorie:     cat,
          quantite:      Number(l.quantite),
          unite:         l.unite,
          prix_unitaire: Number(l.prix_snapshot),
          total:         Number(l.quantite) * Number(l.prix_snapshot),
        });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [commandes, fournNames, categories, period, persoFrom, persoTo, fournFilter, categFilter, produitSearch]);

  // KPIs
  const cmdsDansPeriode = useMemo(() => {
    const range = periodRange(period, persoFrom, persoTo);
    return commandes.filter(c => {
      if (c.statut === "annulee") return false;
      if (fournFilter !== "tous" && fournIdOf(c) !== fournFilter) return false;
      if (!range) return true;
      const d = new Date(c.created_at);
      return d >= range[0] && d <= range[1];
    });
  }, [commandes, period, persoFrom, persoTo, fournFilter]);

  const totalDepense   = cmdsDansPeriode.reduce((s, c) => s + montantNet(c), 0);
  const nbCmds         = cmdsDansPeriode.length;
  const panierMoyen    = nbCmds > 0 ? totalDepense / nbCmds : 0;

  // Économies : pour chaque ligne, on compare au prix MAX vu sur le même produit
  const economies = useMemo(() => {
    const maxParProduit = new Map<string, number>();
    lignes.forEach(l => {
      maxParProduit.set(l.produit.toLowerCase(), Math.max(maxParProduit.get(l.produit.toLowerCase()) ?? 0, l.prix_unitaire));
    });
    return lignes.reduce((s, l) => s + (((maxParProduit.get(l.produit.toLowerCase()) ?? l.prix_unitaire) - l.prix_unitaire) * l.quantite), 0);
  }, [lignes]);

  // Graphique dépenses par semaine
  const evolution = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const c of cmdsDansPeriode) {
      const d = new Date(c.created_at);
      // YYYY-WW
      const week = `${d.getFullYear()}-W${String(Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7)).padStart(2, "0")}`;
      buckets.set(week, (buckets.get(week) ?? 0) + montantNet(c));
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([w, v]) => ({ periode: w, depense: Math.round(v * 100) / 100 }));
  }, [cmdsDansPeriode]);

  // Top 10
  const top10Valeur = useMemo(() => {
    const map = new Map<string, { nom: string; valeur: number; qte: number }>();
    lignes.forEach(l => {
      const k = l.produit.toLowerCase();
      if (!map.has(k)) map.set(k, { nom: l.produit, valeur: 0, qte: 0 });
      const e = map.get(k)!;
      e.valeur += l.total;
      e.qte    += l.quantite;
    });
    return Array.from(map.values()).sort((a, b) => b.valeur - a.valeur).slice(0, 10);
  }, [lignes]);

  const top10Volume = useMemo(() => [...top10Valeur].sort((a, b) => b.qte - a.qte), [top10Valeur]);

  const fournUniques = useMemo(() => {
    const ids = Array.from(new Set(commandes.map(c => fournIdOf(c)).filter(Boolean)));
    return ids.map(id => ({ id, nom: fournNames[id] ?? id.slice(0, 6) }));
  }, [commandes, fournNames]);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Produit", "Catégorie", "Fournisseur", "Quantité", "Unité", "PU HT", "Total HT", "TVA 20%", "Total TTC"],
      ...lignes.map(l => [
        new Date(l.date).toLocaleDateString("fr-FR"),
        l.produit,
        CAT_LABELS[l.categorie] ?? l.categorie,
        l.fournNom,
        l.quantite,
        l.unite,
        l.prix_unitaire.toFixed(2),
        l.total.toFixed(2),
        (l.total * 0.20).toFixed(2),
        (l.total * 1.20).toFixed(2),
      ]),
    ];
    downloadCsv(`achats-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[18px] font-[650] tracking-[-0.01em] text-[var(--text)]">Historique d&apos;achats</h2>

      {/* Filtres */}
      <div className="rounded-[10px] border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Période</span>
            <select value={period} onChange={e => setPeriod(e.target.value as Period)}
                    className="min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-sm focus:border-[var(--accent)]">
              <option value="jour">Aujourd&apos;hui</option>
              <option value="7j">7 derniers jours</option>
              <option value="30j">30 derniers jours</option>
              <option value="3m">3 derniers mois</option>
              <option value="1an">12 derniers mois</option>
              <option value="tous">Tout</option>
              <option value="perso">Personnalisée</option>
            </select>
          </label>
          {period === "perso" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Du</span>
                <input type="date" value={persoFrom} onChange={e => setPFrom(e.target.value)}
                       className="min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-sm" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Au</span>
                <input type="date" value={persoTo} onChange={e => setPTo(e.target.value)}
                       className="min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-sm" />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Fournisseur</span>
            <select value={fournFilter} onChange={e => setFF(e.target.value)}
                    className="min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-sm">
              <option value="tous">Tous</option>
              {fournUniques.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Catégorie</span>
            <select value={categFilter} onChange={e => setCF(e.target.value)}
                    className="min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-sm">
              <option value="tous">Toutes</option>
              {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-1 min-w-48 flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Produit</span>
            <input value={produitSearch} onChange={e => setPS(e.target.value)} placeholder="Rechercher…"
                   className="min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-sm" />
          </label>
          <button onClick={exportCsv} disabled={lignes.length === 0}
                  className="min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-indigo-300 disabled:opacity-50">
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total dépensé" value={fmt(totalDepense)} />
        <Kpi label="Commandes"     value={String(nbCmds)} />
        <Kpi label="Panier moyen"  value={fmt(panierMoyen)} />
        <Kpi label="Économies"     value={fmt(economies)} accent="emerald" sub="vs prix max observé" />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
      ) : (
        <>
          {/* Graphique évolution */}
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Évolution des dépenses</h3>
            {evolution.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Aucune donnée pour la période.</p>
            ) : (
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" />
                    <XAxis dataKey="periode" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                    <Line type="monotone" dataKey="depense" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top 10 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <TopChart title="Top 10 par valeur"  items={top10Valeur} dataKey="valeur" isEuro />
            <TopChart title="Top 10 par volume"  items={top10Volume} dataKey="qte"    />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Produit</th>
                  <th className="px-4 py-3 text-left">Fournisseur</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3 text-right">PU HT</th>
                  <th className="px-4 py-3 text-right">Total HT</th>
                  <th className="px-4 py-3 text-right">TVA 20%</th>
                  <th className="px-4 py-3 text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lignes.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-gray-500">Aucun achat dans cette période.</td></tr>
                ) : lignes.slice(0, 300).map((l, i) => {
                  // Achats B2B : TVA 20% par défaut. Les prix_snapshot sont stockés HT.
                  const totalHT  = l.total;
                  const tva      = totalHT * 0.20;
                  const totalTTC = totalHT * 1.20;
                  return (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[var(--bg-subtle)]"}>
                      <td className="px-4 py-2 text-gray-500">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-2 text-[var(--text)]">{l.produit}</td>
                      <td className="px-4 py-2 text-gray-600">{l.fournNom}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{l.quantite} {l.unite}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{fmt(l.prix_unitaire)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-[var(--text)]">{fmt(totalHT)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{fmt(tva)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{fmt(totalTTC)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lignes.length > 300 && (
              <p className="px-4 py-3 text-xs text-gray-500">
                {lignes.length - 300} lignes supplémentaires — utilisez l&apos;export CSV pour tout récupérer.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" }) {
  const border = accent === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-[var(--border)] bg-white";
  const txt    = accent === "emerald" ? "text-emerald-700" : "text-[var(--text)]";
  return (
    <div className={`rounded-[10px] border ${border} p-4 shadow-sm`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${txt}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-500">{sub}</p>}
    </div>
  );
}

function TopChart({ title, items, dataKey, isEuro }: { title: string; items: { nom: string; valeur: number; qte: number }[]; dataKey: "valeur" | "qte"; isEuro?: boolean }) {
  const data = items.map(i => ({ nom: i.nom.slice(0, 20), [dataKey]: dataKey === "valeur" ? i.valeur : i.qte }));
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">{title}</h3>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Aucune donnée.</p>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} />
              <YAxis type="category" dataKey="nom" tick={{ fontSize: 11, fill: "#6B7280" }} width={75} />
              <Tooltip formatter={(v: unknown) => isEuro ? fmt(Number(v)) : String(Math.round(Number(v)))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
              <Bar dataKey={dataKey} fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
