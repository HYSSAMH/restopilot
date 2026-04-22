"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt, CAT_LABELS } from "@/lib/gestion-data";

type Source = "mercuriale" | "historique" | "import";

interface ProduitRow {
  id:                 string;         // identifiant unique ligne (tarif:id ou histo:nom)
  source:             Source;
  tarif_id:           string | null;
  produit_id:         string | null;
  produit_nom:        string;
  produit_categorie:  string;
  fournisseur_id:     string | null;
  fournisseur_nom:    string | null;
  unite:              string;
  prix_ht:            number;
  tva_taux:           number;          // 20 par défaut pour achat pro
  prix_precedent:     number | null;
  prix_precedent_maj: string | null;
  updated_at:         string;
  used_in_fiches:     number;
}

type SortKey = "nom" | "prix_asc" | "prix_desc" | "updated";

const inputCls = "min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

const SOURCE_LABEL: Record<Source, string> = {
  mercuriale: "Mercuriale (fournisseur)",
  historique: "Historique d'achats",
  import:     "Facture importée",
};
const SOURCE_BADGE: Record<Source, string> = {
  mercuriale: "bg-indigo-50 text-indigo-700",
  historique: "bg-emerald-50 text-emerald-700",
  import:     "bg-amber-50 text-amber-700",
};

export default function MercurialePage() {
  const { profile } = useProfile();
  const supa = useMemo(() => createClient(), []);
  const [rows, setRows]       = useState<ProduitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts]   = useState({ tarifs: 0, lignes: 0, fiches: 0 });

  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [fournFilter, setFournFilter] = useState<string>("");
  const [srcFilter, setSrcFilter] = useState<Source | "">("");
  const [sort, setSort]           = useState<SortKey>("nom");

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    console.group("[mercuriale] chargement sources");

    // ── 1. MERCURIALE — tarifs fournisseurs ──
    // Requête résiliente : on utilise select("*") pour ne pas casser si des
    // colonnes (tva_taux, prix_precedent...) n'existent pas encore en DB.
    // Les champs potentiels sont ensuite lus avec fallback `?? défaut`.
    const tarifsRes = await supa
      .from("tarifs")
      .select("*, produits(nom, categorie), fournisseurs(id, nom)")
      .eq("actif", true);
    if (tarifsRes.error) console.error("[mercuriale] tarifs ERROR:", tarifsRes.error);
    console.log(`[mercuriale] tarifs actifs   → ${tarifsRes.data?.length ?? 0}`);

    type TarifRaw = {
      id: string; prix: number | null; unite: string; produit_id: string;
      actif?: boolean;
      tva_taux?: number | null;
      prix_precedent?: number | null;
      prix_precedent_maj?: string | null;
      updated_at?: string;
      produits: { nom: string; categorie: string } | null;
      fournisseurs: { id: string; nom: string } | null;
    };

    const fromTarifs: ProduitRow[] = ((tarifsRes.data ?? []) as unknown as TarifRaw[]).map(t => ({
      id:                 `tarif:${t.id}`,
      source:             "mercuriale",
      tarif_id:           t.id,
      produit_id:         t.produit_id,
      produit_nom:        t.produits?.nom ?? "—",
      produit_categorie:  t.produits?.categorie ?? "autre",
      fournisseur_id:     t.fournisseurs?.id ?? null,
      fournisseur_nom:    t.fournisseurs?.nom ?? null,
      unite:              t.unite ?? "pièce",
      prix_ht:            Number(t.prix ?? 0),
      tva_taux:           Number(t.tva_taux ?? 20),
      prix_precedent:     t.prix_precedent != null ? Number(t.prix_precedent) : null,
      prix_precedent_maj: t.prix_precedent_maj ?? null,
      updated_at:         t.updated_at ?? new Date(0).toISOString(),
      used_in_fiches:     0,  // rempli plus bas
    }));

    // ── 2. HISTORIQUE D'ACHATS — dernier prix payé par produit ──
    // On lit commandes + lignes_commande du restaurateur et on déduplique par
    // (nom_snapshot, fournisseur_id ou fournisseur_externe_id) en gardant la
    // dernière occurrence chronologique.
    const cmdRes = await supa
      .from("commandes")
      .select(`
        id, fournisseur_id, fournisseur_externe_id, source, created_at,
        fournisseurs(nom),
        fournisseurs_externes(nom),
        lignes_commande(id, nom_snapshot, prix_snapshot, unite)
      `)
      .eq("restaurateur_id", profile.id)
      .neq("statut", "annulee")
      .order("created_at", { ascending: false })
      .limit(500);
    if (cmdRes.error) console.error("[mercuriale] commandes ERROR:", cmdRes.error);

    type CmdRaw = {
      id: string;
      fournisseur_id: string | null;
      fournisseur_externe_id: string | null;
      source: string | null;
      created_at: string;
      fournisseurs: { nom: string } | null;
      fournisseurs_externes: { nom: string } | null;
      lignes_commande: { id: string; nom_snapshot: string; prix_snapshot: number; unite: string }[] | null;
    };
    const fromLignes: ProduitRow[] = [];
    const dedupHisto = new Map<string, ProduitRow>();   // key = nom|four_id
    let totalLignes = 0;
    ((cmdRes.data ?? []) as unknown as CmdRaw[]).forEach(c => {
      const isImport = c.source === "import";
      const fournNom = c.fournisseurs?.nom ?? c.fournisseurs_externes?.nom ?? null;
      const fournId  = c.fournisseur_id ?? c.fournisseur_externe_id ?? null;
      (c.lignes_commande ?? []).forEach(l => {
        totalLignes += 1;
        const nom = (l.nom_snapshot ?? "").trim();
        if (!nom) return;
        const key = `${nom.toLowerCase()}|${fournId ?? "none"}`;
        if (dedupHisto.has(key)) return;  // on garde la 1ère = la + récente
        dedupHisto.set(key, {
          id:                 `histo:${l.id}`,
          source:             isImport ? "import" : "historique",
          tarif_id:           null,
          produit_id:         null,
          produit_nom:        nom,
          produit_categorie:  "autre",
          fournisseur_id:     fournId,
          fournisseur_nom:    fournNom,
          unite:              l.unite ?? "pièce",
          prix_ht:            Number(l.prix_snapshot ?? 0),
          tva_taux:           20,  // achat pro par défaut
          prix_precedent:     null,
          prix_precedent_maj: null,
          updated_at:         c.created_at,
          used_in_fiches:     0,
        });
      });
    });
    dedupHisto.forEach(v => fromLignes.push(v));
    console.log(`[mercuriale] lignes_commande → ${totalLignes} lignes, ${fromLignes.length} produits uniques (histo+import)`);

    // ── 3. Fusion : si un produit existe dans tarifs ET historique, on garde tarifs ──
    const merged = new Map<string, ProduitRow>();
    fromTarifs.forEach(r => {
      const k = `${r.produit_nom.toLowerCase()}|${r.fournisseur_id ?? "none"}`;
      merged.set(k, r);
    });
    fromLignes.forEach(r => {
      const k = `${r.produit_nom.toLowerCase()}|${r.fournisseur_id ?? "none"}`;
      if (!merged.has(k)) merged.set(k, r);
    });
    const allRows = Array.from(merged.values());
    console.log(`[mercuriale] fusion          → ${allRows.length} produits au total`);

    // ── 4. Comptage : utilisations dans les fiches techniques ──
    const usageRes = await supa
      .from("fiche_ingredients")
      .select("tarif_id, nom, menu_plats!inner(restaurateur_id)")
      .eq("menu_plats.restaurateur_id", profile.id);
    if (usageRes.error) console.error("[mercuriale] usage ERROR:", usageRes.error);

    type UsageRaw = { tarif_id: string | null; nom: string };
    const byTarif = new Map<string, number>();
    const byNom   = new Map<string, number>();
    ((usageRes.data ?? []) as unknown as UsageRaw[]).forEach(u => {
      if (u.tarif_id) byTarif.set(u.tarif_id, (byTarif.get(u.tarif_id) ?? 0) + 1);
      if (u.nom) {
        const k = u.nom.toLowerCase().trim();
        byNom.set(k, (byNom.get(k) ?? 0) + 1);
      }
    });
    allRows.forEach(r => {
      if (r.tarif_id) r.used_in_fiches = byTarif.get(r.tarif_id) ?? 0;
      else            r.used_in_fiches = byNom.get(r.produit_nom.toLowerCase().trim()) ?? 0;
    });

    setRows(allRows);
    setCounts({
      tarifs: fromTarifs.length,
      lignes: fromLignes.length,
      fiches: usageRes.data?.length ?? 0,
    });
    setLoading(false);
    console.groupEnd();
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
    if (srcFilter)   list = list.filter(r => r.source === srcFilter);

    const copy = [...list];
    if (sort === "nom")       copy.sort((a, b) => a.produit_nom.localeCompare(b.produit_nom));
    if (sort === "prix_asc")  copy.sort((a, b) => a.prix_ht - b.prix_ht);
    if (sort === "prix_desc") copy.sort((a, b) => b.prix_ht - a.prix_ht);
    if (sort === "updated")   copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return copy;
  }, [rows, search, catFilter, fournFilter, srcFilter, sort]);

  // Comparateur : regroupe par produit_nom les offres de plusieurs fournisseurs
  const comparator = useMemo(() => {
    const groups = new Map<string, ProduitRow[]>();
    filtered.forEach(r => {
      const key = r.produit_nom.toLowerCase().trim();
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    });
    return Array.from(groups.values())
      .filter(arr => arr.length > 1)
      .map(arr => {
        const sorted = [...arr].sort((a, b) => a.prix_ht - b.prix_ht);
        const econ  = sorted[sorted.length - 1].prix_ht - sorted[0].prix_ht;
        const pct   = sorted[sorted.length - 1].prix_ht > 0 ? (econ / sorted[sorted.length - 1].prix_ht) * 100 : 0;
        return { offers: sorted, economie: econ, economiePct: pct };
      })
      .sort((a, b) => b.economie - a.economie)
      .slice(0, 10);
  }, [filtered]);

  // Alertes : tarifs utilisés dans fiche + variation > 5 %
  const alertes = useMemo(() => rows.filter(r =>
    r.used_in_fiches > 0
    && r.prix_precedent != null
    && r.prix_precedent > 0
    && Math.abs((r.prix_ht - r.prix_precedent) / r.prix_precedent) > 0.05,
  ), [rows]);

  function variationInfo(r: ProduitRow): { pct: number; sign: "+" | "-" | null } {
    if (r.prix_precedent == null || r.prix_precedent === 0) return { pct: 0, sign: null };
    const delta = (r.prix_ht - r.prix_precedent) / r.prix_precedent;
    return { pct: delta * 100, sign: delta > 0 ? "+" : delta < 0 ? "-" : null };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
      <p className="mb-6 text-sm text-gray-500">
        Vue consolidée de toutes vos sources de produits. Prix HT et TTC, variations et comparateur inter-fournisseurs.
      </p>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      ) : (
        <>
          {/* Compteurs de sources */}
          <div className="mb-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-700">Mercuriale fournisseurs</p>
              <p className="mt-1 text-xl font-bold text-indigo-700">{counts.tarifs}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">Historique + factures</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{counts.lignes}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Total unique</p>
              <p className="mt-1 text-xl font-bold text-[#1A1A2E]">{rows.length}</p>
            </div>
          </div>

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
                      {fmt(r.prix_precedent!)} → {fmt(r.prix_ht)}{" "}
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
                <span className="text-xs font-medium text-gray-600">Source</span>
                <select value={srcFilter} onChange={e => setSrcFilter(e.target.value as Source | "")} className={inputCls}>
                  <option value="">Toutes</option>
                  <option value="mercuriale">Mercuriale</option>
                  <option value="historique">Historique</option>
                  <option value="import">Factures</option>
                </select>
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
              {(search || catFilter || fournFilter || srcFilter) && (
                <button onClick={() => { setSearch(""); setCatFilter(""); setFournFilter(""); setSrcFilter(""); }}
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
                        Économie {fmt(c.economie)} HT (−{c.economiePct.toFixed(1)} %)
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
                            {fmt(o.prix_ht)} HT / {o.unite}
                          </span>
                          <span className="text-gray-500">
                            ({fmt(o.prix_ht * (1 + o.tva_taux / 100))} TTC)
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
                <table className="w-full min-w-[1000px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 text-left">Produit</th>
                      <th className="px-3 py-2 text-left">Source</th>
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
                      const ttc = r.prix_ht * (1 + r.tva_taux / 100);
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-medium text-[#1A1A2E]">{r.produit_nom}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[r.source]}`}>
                              {SOURCE_LABEL[r.source]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">{r.fournisseur_nom ?? "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{r.unite}</td>
                          <td className="px-3 py-2 text-right font-semibold text-[#1A1A2E]">{fmt(r.prix_ht)}</td>
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
                            {r.produit_id ? (
                              <Link
                                href={`/dashboard/restaurateur/commandes?produit=${r.produit_id}`}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                              >
                                Commander
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
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
