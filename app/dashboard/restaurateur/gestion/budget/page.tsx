"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { loadRestaurateurData, montantNet, fmt, CAT_LABELS, CAT_COLORS, type Commande } from "@/lib/gestion-data";

const OBJECTIF_KEY = "restopilot_budget_config";

export default function BudgetPage() {
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);

  // Objectif (stocké en localStorage pour MVP)
  const [objectifPct, setObj] = useState(28);
  const [caMensuelEstime, setCA] = useState(25000);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(OBJECTIF_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.objectifPct === "number")     setObj(p.objectifPct);
        if (typeof p.caMensuelEstime === "number") setCA(p.caMensuelEstime);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OBJECTIF_KEY, JSON.stringify({ objectifPct, caMensuelEstime }));
    } catch {}
  }, [objectifPct, caMensuelEstime]);

  useEffect(() => {
    (async () => {
      const d = await loadRestaurateurData();
      setCommandes(d.commandes);
      setCategories(d.categories);
      setLoading(false);
    })();
  }, []);

  // Coût matière par mois (12 derniers mois)
  const parMois = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map.set(d.toISOString().slice(0, 7), 0);
    }
    for (const c of commandes) {
      const k = c.created_at.slice(0, 7);
      if (!map.has(k)) continue;
      map.set(k, (map.get(k) ?? 0) + montantNet(c));
    }
    const budgetCible = (objectifPct / 100) * caMensuelEstime;
    return Array.from(map.entries()).map(([mois, valeur]) => ({
      mois:     mois.slice(5),
      depense:  Math.round(valeur * 100) / 100,
      budget:   Math.round(budgetCible * 100) / 100,
    }));
  }, [commandes, objectifPct, caMensuelEstime]);

  // Répartition par catégorie (mois courant)
  const parCategorie = useMemo(() => {
    const moisCourant = new Date().toISOString().slice(0, 7);
    const map = new Map<string, number>();
    for (const c of commandes) {
      if (c.statut === "annulee") continue;
      if (!c.created_at.startsWith(moisCourant)) continue;
      for (const l of c.lignes_commande) {
        const cat = categories[l.nom_snapshot] ?? "epicerie";
        const valeur = Number(l.prix_snapshot) * Number(l.quantite);
        map.set(cat, (map.get(cat) ?? 0) + valeur);
      }
    }
    return Array.from(map.entries())
      .map(([cat, v]) => ({ cat, label: CAT_LABELS[cat] ?? cat, value: Math.round(v * 100) / 100, color: CAT_COLORS[cat] ?? "#6366F1" }))
      .sort((a, b) => b.value - a.value);
  }, [commandes, categories]);

  // KPIs mois courant
  const moisCourant = new Date().toISOString().slice(0, 7);
  const depenseMoisCourant = commandes
    .filter(c => c.created_at.startsWith(moisCourant) && c.statut !== "annulee")
    .reduce((s, c) => s + montantNet(c), 0);

  const budgetCible        = (objectifPct / 100) * caMensuelEstime;
  const pctRealise         = budgetCible > 0 ? (depenseMoisCourant / budgetCible) * 100 : 0;
  const ecartBudget        = budgetCible - depenseMoisCourant;
  const coutMatierePct     = caMensuelEstime > 0 ? (depenseMoisCourant / caMensuelEstime) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#1A1A2E]">Budget &amp; coûts matières</h2>

      {/* Config objectif */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1A1A2E]">Objectif &amp; paramètres</h3>
        <p className="mt-1 text-xs text-gray-500">
          Sert à calculer votre budget cible mensuel. Les valeurs sont mémorisées localement dans ce navigateur.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">CA mensuel estimé (€)</span>
            <input type="number" min="0" step="100" value={caMensuelEstime}
                   onChange={e => setCA(parseFloat(e.target.value) || 0)}
                   className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Objectif coût matières (% du CA)</span>
            <input type="number" min="0" max="100" step="0.5" value={objectifPct}
                   onChange={e => setObj(parseFloat(e.target.value) || 0)}
                   className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-500" />
          </label>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Budget cible : <span className="font-semibold text-[#1A1A2E]">{fmt(budgetCible)} /mois</span>
        </p>
      </div>

      {/* KPIs mois en cours */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Dépensé ce mois" value={fmt(depenseMoisCourant)} />
        <Kpi label="Budget cible"    value={fmt(budgetCible)} />
        <Kpi label={ecartBudget >= 0 ? "Marge restante" : "Dépassement"}
             value={fmt(Math.abs(ecartBudget))}
             accent={ecartBudget >= 0 ? "emerald" : "rose"} />
        <Kpi label="Coût matière réel" value={`${coutMatierePct.toFixed(1)}%`}
             accent={coutMatierePct > objectifPct ? "rose" : "emerald"}
             sub={`objectif ${objectifPct}%`} />
      </div>

      {/* Barre de progression */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Avancement du mois</span>
          <span>{pctRealise.toFixed(0)}% du budget</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full transition-all ${pctRealise > 100 ? "bg-rose-500" : pctRealise > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, pctRealise)}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Évolution mensuelle */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Dépenses vs budget (12 mois)</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={parMois}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                  <Bar dataKey="budget"  fill="#E5E7EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="depense" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Camembert catégories */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Répartition du mois par catégorie</h3>
            {parCategorie.length === 0 ? (
              <p className="py-20 text-center text-sm text-gray-500">Aucune dépense ce mois-ci.</p>
            ) : (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={parCategorie} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                      {parCategorie.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" | "rose" }) {
  const cls = accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : accent === "rose"    ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-gray-200 bg-white text-[#1A1A2E]";
  const [border, bg, txt] = cls.split(" ");
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 shadow-sm`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${txt}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-500">{sub}</p>}
    </div>
  );
}
