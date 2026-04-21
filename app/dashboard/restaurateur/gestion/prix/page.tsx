"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { loadRestaurateurData, montantNet, fmt, fournIdOf, type Commande } from "@/lib/gestion-data";

function detailHref(produit: string) {
  return `/dashboard/restaurateur/gestion/prix/${encodeURIComponent(produit)}`;
}

interface AchatProduit {
  produit: string;
  dates:   { date: string; prix: number; fournId: string }[];
  dernierPrix:       number;
  dernierFournId:    string;
  prixMoyen:         number;
  prixMax:           number;
  prixMin:           number;
  evolPct:           number;   // dernier vs avant-dernier
  meilleurCatalogue: { prix: number; fournId: string } | null;
}

export default function PrixPage() {
  const router = useRouter();
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [catalogueMin, setCatMin]   = useState<Record<string, { prix: number; fournId: string }>>({});
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const d = await loadRestaurateurData();
      setCommandes(d.commandes);
      setFournNames(d.fournNames);

      // Catalogue actuel : pour chaque produit nom → meilleur prix actif sur RestoPilot
      try {
        const supabase = createClient();
        const { data: tarifs } = await supabase
          .from("tarifs")
          .select("prix, fournisseur_id, produits!inner ( nom )")
          .eq("actif", true).is("archived_at", null);
        type Row = { prix: number; fournisseur_id: string; produits: { nom: string } };
        const map: Record<string, { prix: number; fournId: string }> = {};
        ((tarifs ?? []) as unknown as Row[]).forEach(t => {
          const key = t.produits.nom.toLowerCase().trim();
          if (!map[key] || t.prix < map[key].prix) {
            map[key] = { prix: Number(t.prix), fournId: t.fournisseur_id };
          }
        });
        setCatMin(map);
      } catch (e) { console.warn("[prix] catalogue indispo :", e); }

      setLoading(false);
    })();
  }, []);

  // Agrégation par produit
  const parProduit: AchatProduit[] = useMemo(() => {
    const map = new Map<string, AchatProduit>();
    for (const c of commandes) {
      if (c.statut === "annulee") continue;
      const fId = fournIdOf(c);
      for (const l of c.lignes_commande) {
        const k = l.nom_snapshot.toLowerCase().trim();
        if (!map.has(k)) {
          map.set(k, {
            produit: l.nom_snapshot,
            dates: [],
            dernierPrix: 0, dernierFournId: "",
            prixMoyen: 0, prixMax: 0, prixMin: Infinity,
            evolPct: 0,
            meilleurCatalogue: null,
          });
        }
        const e = map.get(k)!;
        e.dates.push({ date: c.created_at, prix: Number(l.prix_snapshot), fournId: fId });
      }
    }
    // Calculs finaux
    return Array.from(map.values()).map(e => {
      e.dates.sort((a, b) => a.date.localeCompare(b.date));
      const prix = e.dates.map(d => d.prix);
      e.prixMoyen = prix.reduce((s, v) => s + v, 0) / prix.length;
      e.prixMax   = Math.max(...prix);
      e.prixMin   = Math.min(...prix);
      e.dernierPrix    = e.dates[e.dates.length - 1].prix;
      e.dernierFournId = e.dates[e.dates.length - 1].fournId;
      if (e.dates.length > 1) {
        const avant = e.dates[e.dates.length - 2].prix;
        e.evolPct = avant > 0 ? ((e.dernierPrix - avant) / avant) * 100 : 0;
      }
      e.meilleurCatalogue = catalogueMin[e.produit.toLowerCase().trim()] ?? null;
      return e;
    }).sort((a, b) => b.dates.length - a.dates.length);
  }, [commandes, catalogueMin]);

  // Produit sélectionné : courbe détaillée
  const produitSelectionne = useMemo(() => {
    if (!selected) return null;
    return parProduit.find(p => p.produit === selected) ?? null;
  }, [parProduit, selected]);

  // Alertes (augmentation >10%)
  const alertes = parProduit.filter(p => p.evolPct > 10 && p.dates.length >= 2);

  // Économies potentielles (si on avait toujours choisi le moins cher du catalogue)
  const economiesPotentielles = useMemo(() => {
    let total = 0;
    for (const c of commandes) {
      if (c.statut === "annulee") continue;
      for (const l of c.lignes_commande) {
        const mc = catalogueMin[l.nom_snapshot.toLowerCase().trim()];
        if (mc && mc.prix < Number(l.prix_snapshot)) {
          total += (Number(l.prix_snapshot) - mc.prix) * Number(l.quantite);
        }
      }
    }
    return total;
  }, [commandes, catalogueMin]);

  const totalDepense = commandes.reduce((s, c) => s + montantNet(c), 0);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#1A1A2E]">Analyse des prix</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Produits suivis" value={String(parProduit.length)} />
        <Kpi label="Alertes +10%"    value={String(alertes.length)} accent={alertes.length > 0 ? "rose" : undefined} />
        <Kpi label="Total historique" value={fmt(totalDepense)} />
        <Kpi label="Économies possibles" value={fmt(economiesPotentielles)} accent="emerald" sub="en choisissant toujours le moins cher du catalogue" />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      ) : (
        <>
          {/* Alertes */}
          {alertes.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h3 className="text-sm font-semibold text-rose-800">⚠ Hausses de prix détectées</h3>
              <p className="mt-1 text-xs text-rose-700">
                Ces produits ont augmenté de plus de 10% par rapport à votre dernière commande.
              </p>
              <div className="mt-3 space-y-1.5">
                {alertes.slice(0, 8).map(p => (
                  <Link key={p.produit} href={detailHref(p.produit)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm transition-colors hover:bg-rose-100">
                    <span className="truncate text-[#1A1A2E]">{p.produit}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-rose-700">+{p.evolPct.toFixed(1)}%</span>
                      <span className="text-rose-500">→</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Sélecteur produit + courbe */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#1A1A2E]">Évolution du prix</h3>
              <select
                value={selected ?? ""}
                onChange={e => setSelected(e.target.value || null)}
                className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">— Choisir un produit —</option>
                {parProduit.slice(0, 50).map(p => <option key={p.produit} value={p.produit}>{p.produit}</option>)}
              </select>
            </div>
            {produitSelectionne ? (
              <>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={produitSelectionne.dates.map(d => ({
                      date: new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
                      prix: Math.round(d.prix * 100) / 100,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6B7280" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                      <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                      <Line type="monotone" dataKey="prix" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                  <Stat label="Dernier prix payé" value={fmt(produitSelectionne.dernierPrix)} hint={fournNames[produitSelectionne.dernierFournId] ?? "—"} />
                  <Stat label="Prix moyen"        value={fmt(produitSelectionne.prixMoyen)} />
                  <Stat label="Min / Max"         value={`${fmt(produitSelectionne.prixMin)} / ${fmt(produitSelectionne.prixMax)}`} />
                  <Stat
                    label="Meilleur catalogue"
                    value={produitSelectionne.meilleurCatalogue ? fmt(produitSelectionne.meilleurCatalogue.prix) : "—"}
                    hint={produitSelectionne.meilleurCatalogue ? (fournNames[produitSelectionne.meilleurCatalogue.fournId] ?? "—") : undefined}
                    accent={produitSelectionne.meilleurCatalogue && produitSelectionne.meilleurCatalogue.prix < produitSelectionne.dernierPrix ? "emerald" : undefined}
                  />
                </div>
              </>
            ) : (
              <p className="py-10 text-center text-sm text-gray-500">
                Sélectionnez un produit pour voir son évolution.
              </p>
            )}
          </div>

          {/* Tableau par produit */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">Produit</th>
                  <th className="px-4 py-3 text-right">Dernier prix</th>
                  <th className="px-4 py-3 text-right">Évolution</th>
                  <th className="px-4 py-3 text-right">Meilleur catalogue</th>
                  <th className="px-4 py-3 text-right">Économie/u</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parProduit.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-500">Aucun historique.</td></tr>
                ) : parProduit.slice(0, 50).map(p => {
                  const economie = p.meilleurCatalogue && p.meilleurCatalogue.prix < p.dernierPrix
                    ? p.dernierPrix - p.meilleurCatalogue.prix : 0;
                  return (
                    <tr key={p.produit} onClick={() => router.push(detailHref(p.produit))} className="cursor-pointer hover:bg-indigo-50">
                      <td className="px-4 py-2 font-medium text-[#1A1A2E]">
                        {p.produit}
                        <span className="ml-1 text-gray-400">→</span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(p.dernierPrix)}</td>
                      <td className={`px-4 py-2 text-right ${p.evolPct > 10 ? "text-rose-600" : p.evolPct < -5 ? "text-emerald-600" : "text-gray-500"}`}>
                        {p.dates.length < 2 ? "—" : `${p.evolPct >= 0 ? "+" : ""}${p.evolPct.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {p.meilleurCatalogue ? fmt(p.meilleurCatalogue.prix) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right ${economie > 0 ? "font-semibold text-emerald-600" : "text-gray-400"}`}>
                        {economie > 0 ? `−${fmt(economie)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" | "rose" }) {
  const cls = accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : accent === "rose"    ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-gray-200 bg-white text-[#1A1A2E]";
  return (
    <div className={`rounded-2xl border ${cls.split(" ").slice(0, 2).join(" ")} p-4 shadow-sm`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${cls.split(" ")[2]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-500">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: "emerald" }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${accent === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-0.5 font-semibold ${accent === "emerald" ? "text-emerald-700" : "text-[#1A1A2E]"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-gray-500">{hint}</p>}
    </div>
  );
}
