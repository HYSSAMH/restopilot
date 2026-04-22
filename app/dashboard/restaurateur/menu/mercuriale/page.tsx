"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt, CAT_LABELS } from "@/lib/gestion-data";
import { loadProduitSources, type ProduitSource, type ProduitSourceKind } from "@/lib/mercuriale-sources";

type Source = ProduitSourceKind;

interface ProduitRow extends ProduitSource {
  used_in_fiches: number;
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

  // Modale conditionnement
  const [condModal, setCondModal] = useState<ProduitRow | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    console.group("[mercuriale] chargement sources");

    const sources = await loadProduitSources(supa, profile.id, { debug: true });

    // Comptage utilisations dans les fiches
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

    const withUsage: ProduitRow[] = sources.map(s => ({
      ...s,
      used_in_fiches: s.tarif_id
        ? (byTarif.get(s.tarif_id) ?? 0)
        : (byNom.get(s.produit_nom.toLowerCase().trim()) ?? 0),
    }));

    setRows(withUsage);
    setCounts({
      tarifs: sources.filter(s => s.source === "mercuriale").length,
      lignes: sources.filter(s => s.source !== "mercuriale").length,
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
                          <td className="px-3 py-2 text-right">
                            <div className="font-semibold text-[#1A1A2E]">{fmt(r.prix_ht)}</div>
                            {r.prix_unite_travail != null && r.unite_travail && (
                              <div className="text-[10px] font-medium text-emerald-700">
                                → {fmt(r.prix_unite_travail)} / {r.unite_travail}
                              </div>
                            )}
                          </td>
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
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => setCondModal(r)}
                                className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-colors ${
                                  r.prix_unite_travail != null
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-600"
                                }`}
                                title={r.prix_unite_travail != null
                                  ? `Prix de travail : ${fmt(r.prix_unite_travail)} / ${r.unite_travail}`
                                  : "Configurer le conditionnement"}
                              >
                                {r.prix_unite_travail != null ? "⚙ Configuré" : "⚙ Conditionnement"}
                              </button>
                              {r.produit_id ? (
                                <Link
                                  href={`/dashboard/restaurateur/commandes?produit=${r.produit_id}`}
                                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                >
                                  Commander
                                </Link>
                              ) : null}
                            </div>
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

      {condModal && profile?.id && (
        <ConditionnementModal
          produit={condModal}
          restaurateurId={profile.id}
          onClose={() => setCondModal(null)}
          onSaved={async (msg) => {
            setCondModal(null);
            await load();
            // Toast simple (alert remplaçable par un système de notif centralisé)
            if (typeof window !== "undefined") {
              const el = document.createElement("div");
              el.textContent = msg;
              el.className = "fixed bottom-6 right-6 z-[100] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-2xl";
              document.body.appendChild(el);
              setTimeout(() => el.remove(), 3500);
            }
          }}
          supa={supa}
        />
      )}
    </div>
  );
}

// ── Modale conditionnement ────────────────────────────────────────

const UNITES_SOUS = ["g", "kg", "mL", "cL", "L", "piece", "portion"];
const UNITES_TRAVAIL = ["kg", "g", "L", "cL", "mL", "piece", "portion"];

function computePreviewPrix(
  prix: number,
  nb: number | null,
  taille: number | null,
  uniteSous: string | null,
  uniteTravail: string | null,
): number | null {
  if (!nb || !taille || !uniteSous || !uniteTravail) return null;
  const total = nb * taille;
  if (total <= 0 || prix <= 0) return null;
  if (uniteTravail === "piece" || uniteTravail === "portion") return Math.round((prix / nb) * 10000) / 10000;
  if (uniteTravail === uniteSous)                              return Math.round((prix / nb) * 10000) / 10000;

  const factor = (() => {
    if (uniteSous === "g"  && uniteTravail === "kg") return 1 / 1000;
    if (uniteSous === "kg" && uniteTravail === "g")  return 1000;
    if (uniteSous === "mL" && uniteTravail === "L")  return 1 / 1000;
    if (uniteSous === "L"  && uniteTravail === "mL") return 1000;
    if (uniteSous === "cL" && uniteTravail === "L")  return 1 / 100;
    if (uniteSous === "L"  && uniteTravail === "cL") return 100;
    if (uniteSous === "mL" && uniteTravail === "cL") return 1 / 10;
    if (uniteSous === "cL" && uniteTravail === "mL") return 10;
    if (uniteSous === uniteTravail)                  return 1;
    return null;
  })();
  if (factor == null) return null;
  const totalEnTravail = total * factor;
  if (totalEnTravail <= 0) return null;
  return Math.round((prix / totalEnTravail) * 10000) / 10000;
}

function ConditionnementModal({
  produit, restaurateurId, onClose, onSaved, supa,
}: {
  produit: ProduitRow;
  restaurateurId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
  supa: ReturnType<typeof createClient>;
}) {
  const [nb, setNb]               = useState<number>(produit.conditionnement_nb ?? 1);
  const [taille, setTaille]       = useState<number>(Number(produit.conditionnement_taille ?? 0));
  const [uniteSous, setUniteSous] = useState<string>(produit.conditionnement_unite ?? "g");
  const [uniteTravail, setUniteTravail] = useState<string>(produit.unite_travail ?? "kg");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const preview = computePreviewPrix(produit.prix_ht, nb, taille, uniteSous, uniteTravail);

  async function save() {
    setSaving(true); setError(null);
    try {
      // Upsert dans la table unifiée produit_conditionnements :
      // fonctionne pour tarif, historique et facture importée indifféremment.
      const payload = {
        restaurateur_id:        restaurateurId,
        produit_key:            produit.produit_key,
        produit_nom:            produit.produit_nom,
        tarif_id:               produit.tarif_id,
        fournisseur_id:         produit.fournisseur_id,
        prix_reference:         produit.prix_ht,
        conditionnement_nb:     nb > 0 ? nb : null,
        conditionnement_taille: taille > 0 ? taille : null,
        conditionnement_unite:  uniteSous || null,
        unite_travail:          uniteTravail || null,
      };
      const { error: err } = await supa.from("produit_conditionnements")
        .upsert(payload, { onConflict: "restaurateur_id,produit_key" });
      if (err) {
        console.error("[conditionnement] upsert error:", err);
        setError(err.message);
        setSaving(false);
        return;
      }
      onSaved("Conditionnement enregistré ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Retirer le conditionnement de ce produit ?")) return;
    setSaving(true);
    const { error: err } = await supa.from("produit_conditionnements")
      .delete()
      .eq("restaurateur_id", restaurateurId)
      .eq("produit_key", produit.produit_key);
    if (err) {
      console.error("[conditionnement] delete error:", err);
      setError(err.message);
      setSaving(false);
      return;
    }
    onSaved("Conditionnement retiré");
    setSaving(false);
  }

  const inputCls = "min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">Configurer le conditionnement</h2>
            <p className="mt-0.5 text-sm text-gray-500">{produit.produit_nom}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {/* Base facture (non modifiable) */}
        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Prix d&apos;achat (facture — non modifiable)</p>
          <p className="mt-1 text-lg font-bold text-[#1A1A2E]">{fmt(produit.prix_ht)} HT / {produit.unite}</p>
        </div>

        {/* Contenu du conditionnement */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-[#1A1A2E]">Contenu du conditionnement</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Nombre de sous-unités</span>
              <input type="number" min="1" step="1" value={nb || ""}
                     onChange={e => setNb(parseInt(e.target.value) || 0)}
                     className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Taille par sous-unité</span>
              <input type="number" min="0" step="0.001" value={taille || ""}
                     onChange={e => setTaille(parseFloat(e.target.value) || 0)}
                     className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Unité sous-unité</span>
              <select value={uniteSous} onChange={e => setUniteSous(e.target.value)} className={inputCls}>
                {UNITES_SOUS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Ex : « 8 paquets de 800 g » → nb = 8, taille = 800, unité = g
          </p>
        </div>

        {/* Unité de travail */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-[#1A1A2E]">Unité utilisée dans les fiches techniques</p>
          <select value={uniteTravail} onChange={e => setUniteTravail(e.target.value)} className={inputCls}>
            {UNITES_TRAVAIL.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Preview */}
        <div className={`mb-5 rounded-xl border p-4 ${
          preview != null ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}>
          {preview != null ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Prix unitaire de travail calculé</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">
                {fmt(preview)} / {uniteTravail}
              </p>
              <p className="mt-2 text-xs text-emerald-700">
                {fmt(produit.prix_ht)} ÷ ({nb} × {taille} {uniteSous})
                {uniteTravail !== uniteSous && uniteTravail !== "piece" && uniteTravail !== "portion"
                  ? ` converti en ${uniteTravail}`
                  : ""}
                {" "}= {fmt(preview)}/{uniteTravail}
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-800">
              Complétez tous les champs pour voir le calcul.
              {uniteSous && uniteTravail && uniteSous !== uniteTravail
               && !["piece","portion"].includes(uniteTravail)
               && " Conversion impossible entre les unités choisies — essayez kg ↔ g, L ↔ mL ou cL ↔ L."}
            </p>
          )}
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {produit.conditionnement_nb != null ? (
            <button onClick={reset} disabled={saving}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50">
              Retirer le conditionnement
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm">
              Annuler
            </button>
            <button onClick={save} disabled={saving || preview == null}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
