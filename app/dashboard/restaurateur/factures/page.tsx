"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import type { StatutCommande } from "@/lib/supabase/types";
import { regenerateFacturePDF } from "@/lib/facture-from-db";

interface Commande {
  id: string;
  fournisseur_id: string;
  statut: StatutCommande;
  montant_total: number;
  avoir_montant: number | null;
  created_at: string;
  lignes_commande: {
    id: string;
    nom_snapshot: string;
    prix_snapshot: number;
    unite: string;
    quantite: number;
  }[];
}

interface LignesByProduit {
  nom: string;
  totalQte: number;
  totalValeur: number;
  occurrences: { fournisseurId: string; fournisseurNom: string; prix: number; qte: number; date: string }[];
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const STATUT_CHIP: Record<StatutCommande, { label: string; cls: string }> = {
  recue:                       { label: "Reçue",             cls: "border-amber-200 bg-amber-50 text-amber-700" },
  en_preparation:              { label: "En préparation",    cls: "border-blue-200 bg-blue-50 text-blue-700" },
  en_livraison:                { label: "En livraison",      cls: "border-violet-200 bg-violet-50 text-violet-700" },
  livree:                      { label: "Livrée",            cls: "border-sky-200 bg-sky-50 text-sky-700" },
  receptionnee:                { label: "Réceptionnée",      cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  receptionnee_avec_anomalies: { label: "Récep. anomalies",  cls: "border-rose-200 bg-rose-50 text-rose-700" },
  annulee:                     { label: "Annulée",           cls: "border-red-200 bg-red-50 text-red-700" },
};

export default function FacturesPage() {
  const [tab, setTab] = useState<"factures" | "produits">("factures");
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [downloading, setDL]        = useState<string | null>(null);

  // Filtres factures
  const [search, setSearch] = useState("");
  const [fournFilter, setFournFilter] = useState<"tous" | string>("tous");
  const [dateFilter, setDateFilter]   = useState<"tous" | "jour" | "semaine" | "mois">("tous");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("commandes")
        .select(`
          id, fournisseur_id, statut, montant_total, avoir_montant, created_at,
          lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite )
        `)
        .eq("restaurateur_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      const typed = (data ?? []) as unknown as Commande[];
      setCommandes(typed);

      const fournIds = Array.from(new Set(typed.map(c => c.fournisseur_id)));
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
    let arr = commandes;
    if (fournFilter !== "tous") arr = arr.filter(c => c.fournisseur_id === fournFilter);
    if (dateFilter !== "tous") {
      const ref = new Date();
      if (dateFilter === "jour")    ref.setHours(0, 0, 0, 0);
      if (dateFilter === "semaine") ref.setDate(ref.getDate() - 7);
      if (dateFilter === "mois")    ref.setDate(ref.getDate() - 30);
      arr = arr.filter(c => new Date(c.created_at) >= ref);
    }
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(c => (fournNames[c.fournisseur_id] ?? "").toLowerCase().includes(s));
    }
    return arr;
  }, [commandes, fournFilter, dateFilter, search, fournNames]);

  const fournUniques = Array.from(new Set(commandes.map(c => c.fournisseur_id)));
  const totalFiltre = filtered.filter(c => c.statut !== "annulee").reduce((s, c) => s + Number(c.montant_total), 0);

  // Vue par produit
  const parProduit: LignesByProduit[] = useMemo(() => {
    const map = new Map<string, LignesByProduit>();
    filtered.forEach(c => {
      const fournNom = fournNames[c.fournisseur_id] ?? "—";
      c.lignes_commande.forEach(l => {
        const key = l.nom_snapshot.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { nom: l.nom_snapshot, totalQte: 0, totalValeur: 0, occurrences: [] });
        }
        const p = map.get(key)!;
        p.totalQte    += Number(l.quantite);
        p.totalValeur += Number(l.quantite) * Number(l.prix_snapshot);
        p.occurrences.push({
          fournisseurId:  c.fournisseur_id,
          fournisseurNom: fournNom,
          prix:           Number(l.prix_snapshot),
          qte:            Number(l.quantite),
          date:           c.created_at,
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.totalValeur - a.totalValeur);
  }, [filtered, fournNames]);

  async function download(id: string) {
    setDL(id);
    try { await regenerateFacturePDF(id); }
    catch (e) { console.error(e); alert("Erreur lors de la génération du PDF."); }
    setDL(null);
  }

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Factures</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Factures &amp; historique</h1>
          <p className="mt-1 text-sm text-gray-500">
            {commandes.length} facture{commandes.length > 1 ? "s" : ""} au total.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit">
          {([
            { id: "factures", label: "Factures" },
            { id: "produits", label: "Par produit" },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-indigo-500 text-white" : "text-gray-500 hover:text-[#1A1A2E]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtres (communs aux 2 onglets) */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur"
            className="flex-1 min-w-48 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <select
            value={fournFilter}
            onChange={e => setFournFilter(e.target.value)}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="tous">Tous fournisseurs</option>
            {fournUniques.map(id => (
              <option key={id} value={id}>{fournNames[id] ?? id.slice(0, 6)}</option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500"
          >
            <option value="tous">Toutes dates</option>
            <option value="jour">Aujourd&apos;hui</option>
            <option value="semaine">7 derniers jours</option>
            <option value="mois">30 derniers jours</option>
          </select>
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600">
          Total affiché (hors annulées) : <span className="font-semibold text-[#1A1A2E]">{fmt(totalFiltre)}</span>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : tab === "factures" ? (
          filtered.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
              Aucune facture ne correspond.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Fournisseur</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                    <th className="px-5 py-3 text-right">Montant HT</th>
                    <th className="px-5 py-3 text-right">TTC (TVA 10%)</th>
                    <th className="px-5 py-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((c, i) => {
                    const ttc = Number(c.montant_total) * 1.10;
                    const chip = STATUT_CHIP[c.statut];
                    return (
                      <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-5 py-3 text-gray-500">
                          {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 font-medium text-[#1A1A2E]">{fournNames[c.fournisseur_id] ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                            {chip.label}
                          </span>
                          {Number(c.avoir_montant) > 0 && (
                            <span className="ml-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                              Avoir {fmt(Number(c.avoir_montant))}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-[#1A1A2E]">{fmt(c.montant_total)}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{fmt(ttc)}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => download(c.id)}
                            disabled={downloading === c.id}
                            className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
                          >
                            {downloading === c.id ? "…" : "↓ PDF"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          parProduit.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
              Aucune ligne d&apos;achat dans la période.
            </div>
          ) : (
            <div className="space-y-3">
              {parProduit.map((p) => (
                <details key={p.nom} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between p-4 list-none">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-semibold text-[#1A1A2E]">{p.nom}</p>
                      <p className="text-xs text-gray-500">
                        {p.occurrences.length} achat{p.occurrences.length > 1 ? "s" : ""} · {p.totalQte} unités · {fmt(p.totalValeur)}
                      </p>
                    </div>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="border-t border-gray-200 bg-gray-50 p-3">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Fournisseur</th>
                            <th className="px-3 py-2 text-right">Qté</th>
                            <th className="px-3 py-2 text-right">Prix unit.</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {p.occurrences.map((o, i) => (
                            <tr key={i} className="text-[#1A1A2E]">
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(o.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                              </td>
                              <td className="px-3 py-2">{o.fournisseurNom}</td>
                              <td className="px-3 py-2 text-right">{o.qte}</td>
                              <td className="px-3 py-2 text-right">{fmt(o.prix)}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(o.prix * o.qte)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
