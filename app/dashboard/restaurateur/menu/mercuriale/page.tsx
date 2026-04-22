"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt, CAT_LABELS } from "@/lib/gestion-data";

interface TarifRow {
  id: string;
  prix: number;
  prix_precedent: number | null;
  prix_precedent_maj: string | null;
  tva_taux: number;
  unite: string;
  produit_id: string;
  produit_nom: string;
  produit_categorie: string;
  fournisseur_id: string | null;
  fournisseur_nom: string | null;
  updated_at: string;
  used_in_fiches: number;  // nb de fiches qui utilisent ce produit
}

type SortKey = "nom" | "prix_asc" | "prix_desc" | "updated";

const inputCls = "min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

export default function MercurialePage() {
  const { profile } = useProfile();
  const supa = useMemo(() => createClient(), []);
  const [rows, setRows]         = useState<TarifRow[]>([]);
  const [loading, setLoading]   = useState(true);

  const [search, setSearch]     = useState("");
  const [catFilter, setCatFilter]   = useState<string>("");
  const [fournFilter, setFournFilter] = useState<string>("");
  const [sort, setSort]         = useState<SortKey>("nom");

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    // 1. Tarifs actifs avec jointures
    const { data: tarifsRaw } = await supa
      .from("tarifs")
      .select(`
        id, prix, prix_precedent, prix_precedent_maj, tva_taux, unite, updated_at,
        produit_id,
        produits ( nom, categorie ),
        fournisseurs ( id, nom )
      `)
      .eq("actif", true);

    // 2. Count des utilisations dans les fiches techniques du restaurateur
    const { data: usage } = await supa
      .from("fiche_ingredients")
      .select("tarif_id, menu_plats!inner(restaurateur_id)")
      .eq("menu_plats.restaurateur_id", profile.id)
      .not("tarif_id", "is", null);

    const countByTarif = new Map<string, number>();
    (usage ?? []).forEach((u: { tarif_id: string | null }) => {
      if (!u.tarif_id) return;
      countByTarif.set(u.tarif_id, (countByTarif.get(u.tarif_id) ?? 0) + 1);
    });

    type Raw = {
      id: string; prix: number; prix_precedent: number | null; prix_precedent_maj: string | null;
      tva_taux: number | null; unite: string; updated_at: string; produit_id: string;
      produits: { nom: string; categorie: string } | null;
      fournisseurs: { id: string; nom: string } | null;
    };
    const out: TarifRow[] = ((tarifsRaw ?? []) as unknown as Raw[]).map(t => ({
      id:           t.id,
      prix:         Number(t.prix),
      prix_precedent:     t.prix_precedent != null ? Number(t.prix_precedent) : null,
      prix_precedent_maj: t.prix_precedent_maj,
      tva_taux:     Number(t.tva_taux ?? 20),
      unite:        t.unite,
      updated_at:   t.updated_at,
      produit_id:   t.produit_id,
      produit_nom:  t.produits?.nom ?? "—",
      produit_categorie: t.produits?.categorie ?? "autre",
      fournisseur_id:  t.fournisseurs?.id ?? null,
      fournisseur_nom: t.fournisseurs?.nom ?? null,
      used_in_fiches:  countByTarif.get(t.id) ?? 0,
    }));

    setRows(out);
    setLoading(false);
  }, [supa, profile?.id]);

  useEffect(() => { load(); }, [load]);

  // Liste fournisseurs distincts
  const fournisseurs = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => {
      if (r.fournisseur_id && r.fournisseur_nom) map.set(r.fournisseur_id, r.fournisseur_nom);
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [rows]);

  const categories = useMemo(() => {
    const set = new Set(rows.map(r => r.produit_categorie));
    return Array.from(set).sort();
  }, [rows]);

  // Filtre + tri
  const filtered = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.produit_nom.toLowerCase().includes(s)
        || (r.fournisseur_nom ?? "").toLowerCase().includes(s),
      );
    }
    if (catFilter)   list = list.filter(r => r.produit_categorie === catFilter);
    if (fournFilter) list = list.filter(r => r.fournisseur_id === fournFilter);

    const copy = [...list];
    if (sort === "nom")      copy.sort((a, b) => a.produit_nom.localeCompare(b.produit_nom));
    if (sort === "prix_asc") copy.sort((a, b) => a.prix - b.prix);
    if (sort === "prix_desc")copy.sort((a, b) => b.prix - a.prix);
    if (sort === "updated")  copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return copy;
  }, [rows, search, catFilter, fournFilter, sort]);

  // Comparateur : regroupe par produit_nom les tarifs de plusieurs fournisseurs
  const comparator = useMemo(() => {
    const groups = new Map<string, TarifRow[]>();
    filtered.forEach(r => {
      const key = r.produit_nom.toLowerCase().trim();
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    });
    return Array.from(groups.values())
      .filter(arr => arr.length > 1)
      .map(arr => {
        const sorted = [...arr].sort((a, b) => a.prix - b.prix);
        const econ = sorted[sorted.length - 1].prix - sorted[0].prix;
        return { offers: sorted, economie: econ, economiePct: sorted[sorted.length - 1].prix > 0 ? (econ / sorted[sorted.length - 1].prix) * 100 : 0 };
      })
      .sort((a, b) => b.economie - a.economie)
      .slice(0, 10);
  }, [filtered]);

  // Alertes : produits utilisés dans une fiche technique et dont le prix a changé
  const alertes = useMemo(() => rows.filter(r =>
    r.used_in_fiches > 0
    && r.prix_precedent != null
    && r.prix_precedent > 0
    && Math.abs((r.prix - r.prix_precedent) / r.prix_precedent) > 0.05,
  ), [rows]);

  function variationInfo(r: TarifRow): { pct: number; sign: "+" | "-" | null } {
    if (r.prix_precedent == null || r.prix_precedent === 0) return { pct: 0, sign: null };
    const delta = (r.prix - r.prix_precedent) / r.prix_precedent;
    return { pct: delta * 100, sign: delta > 0 ? "+" : delta < 0 ? "-" : null };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
      <p className="mb-6 text-sm text-gray-500">
        Vue consolidée de tous les produits disponibles. Prix HT, TTC, variations et comparateur entre fournisseurs.
      </p>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      ) : (
        <>
          {/* Alertes hausses */}
          {alertes.length > 0 && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                ⚠ {alertes.length} produit{alertes.length > 1 ? "s" : ""} utilisé{alertes.length > 1 ? "s" : ""} dans vos fiches techniques {alertes.length > 1 ? "ont" : "a"} changé de prix ({" > "}5 %)
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {alertes.slice(0, 5).map(r => {
                  const v = variationInfo(r);
                  return (
                    <li key={r.id}>
                      • <span className="font-medium">{r.produit_nom}</span>{" "}
                      ({r.fournisseur_nom ?? "—"}) :{" "}
                      {fmt(r.prix_precedent!)} → {fmt(r.prix)}{" "}
                      <span className={v.sign === "+" ? "text-rose-700" : "text-emerald-700"}>
                        {v.sign}{Math.abs(v.pct).toFixed(1)} %
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Filtres */}
          <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-1 min-w-[200px] flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Recherche</span>
                <input value={search} onChange={e => setSearch(e.target.value)}
                       placeholder="🔍 Nom produit ou fournisseur"
                       className={inputCls} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Catégorie</span>
                <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={inputCls}>
                  <option value="">Toutes</option>
                  {categories.map(c => <option key={c} value={c}>{CAT_LABELS[c] ?? c}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Fournisseur</span>
                <select value={fournFilter} onChange={e => setFournFilter(e.target.value)} className={inputCls}>
                  <option value="">Tous</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Trier par</span>
                <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className={inputCls}>
                  <option value="nom">Nom</option>
                  <option value="prix_asc">Prix croissant</option>
                  <option value="prix_desc">Prix décroissant</option>
                  <option value="updated">Dernière mise à jour</option>
                </select>
              </label>
              {(search || catFilter || fournFilter) && (
                <button onClick={() => { setSearch(""); setCatFilter(""); setFournFilter(""); }}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:border-indigo-300">
                  Réinitialiser
                </button>
              )}
            </div>
          </section>

          {/* Comparateur multi-fournisseurs */}
          {comparator.length > 0 && (
            <section className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-indigo-900">
                💰 Comparateur — économies potentielles
              </h3>
              <p className="mb-3 text-xs text-indigo-700">
                Produits disponibles chez plusieurs fournisseurs : le moins cher vs le plus cher.
              </p>
              <div className="space-y-2">
                {comparator.map((c, i) => (
                  <div key={i} className="rounded-xl border border-indigo-100 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-[#1A1A2E]">{c.offers[0].produit_nom}</p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Économie {fmt(c.economie)} (−{c.economiePct.toFixed(1)} %)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.offers.map((o, j) => (
                        <div key={o.id}
                             className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                               j === 0 ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-gray-50"
                             }`}>
                          <span className="font-medium text-[#1A1A2E]">{o.fournisseur_nom ?? "—"}</span>
                          <span className={j === 0 ? "font-bold text-emerald-700" : "font-semibold text-gray-700"}>
                            {fmt(o.prix)} HT / {o.unite}
                          </span>
                          <span className="text-gray-500">
                            ({fmt(o.prix * (1 + o.tva_taux / 100))} TTC)
                          </span>
                          {j === 0 && <span className="text-xs font-bold text-emerald-600">✓ moins cher</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Liste complète */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1A1A2E]">Produits ({filtered.length})</h3>
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun produit ne correspond.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 text-left">Produit</th>
                      <th className="px-3 py-2 text-left">Catégorie</th>
                      <th className="px-3 py-2 text-left">Fournisseur</th>
                      <th className="px-3 py-2 text-left">Unité</th>
                      <th className="px-3 py-2 text-right">Prix HT</th>
                      <th className="px-3 py-2 text-right">TVA</th>
                      <th className="px-3 py-2 text-right">Prix TTC</th>
                      <th className="px-3 py-2 text-right">Variation</th>
                      <th className="px-3 py-2 text-left">Maj</th>
                      <th className="px-3 py-2 text-center">Fiches</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(r => {
                      const v = variationInfo(r);
                      const ttc = r.prix * (1 + r.tva_taux / 100);
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-medium text-[#1A1A2E]">{r.produit_nom}</td>
                          <td className="px-3 py-2 text-gray-500">{CAT_LABELS[r.produit_categorie] ?? r.produit_categorie}</td>
                          <td className="px-3 py-2 text-gray-600">{r.fournisseur_nom ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{r.unite}</td>
                          <td className="px-3 py-2 text-right font-semibold text-[#1A1A2E]">{fmt(r.prix)}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{r.tva_taux}%</td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmt(ttc)}</td>
                          <td className="px-3 py-2 text-right">
                            {v.sign === null ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                v.sign === "+" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                              }`}>
                                {v.sign === "+" ? "↗" : "↘"} {Math.abs(v.pct).toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {new Date(r.updated_at).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.used_in_fiches > 0 ? (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                {r.used_in_fiches}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Link
                              href={`/dashboard/restaurateur/commandes?produit=${r.produit_id}`}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Commander
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
