"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt } from "@/lib/gestion-data";

interface Categorie {
  id: string; nom: string; ordre: number;
}
interface Plat {
  id: string;
  categorie_id: string | null;
  nom: string;
  description: string | null;
  photo_url: string | null;
  cout_revient_total: number;
  cout_revient_precedent: number | null;
  prix_vente_ttc: number;
  tva_taux: number;
  portions_par_recette: number;
  popularite_score: number;
  actif: boolean;
}

function margeInfo(plat: Plat) {
  const coutUnit = plat.portions_par_recette > 0 ? plat.cout_revient_total / plat.portions_par_recette : 0;
  const prixHT   = plat.prix_vente_ttc / (1 + plat.tva_taux / 100);
  const marge    = prixHT - coutUnit;
  const margePct = prixHT > 0 ? (marge / prixHT) * 100 : 0;
  return { coutUnit, prixHT, marge, margePct };
}

function margeColor(pct: number): "emerald" | "amber" | "rose" {
  if (pct >= 70) return "emerald";
  if (pct >= 50) return "amber";
  return "rose";
}

const inputCls = "min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

export default function MenuDashboardPage() {
  const { profile } = useProfile();
  const supa = useMemo(() => createClient(), []);

  const [categories, setCategories] = useState<Categorie[]>([]);
  const [plats, setPlats]           = useState<Plat[]>([]);
  const [loading, setLoading]       = useState(true);

  const [newCat, setNewCat]         = useState("");
  const [newPlatNom, setNewPlatNom] = useState("");
  const [newPlatCat, setNewPlatCat] = useState("");

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [cats, pls] = await Promise.all([
      supa.from("menu_categories").select("*").eq("restaurateur_id", profile.id).order("ordre"),
      supa.from("menu_plats").select("*").eq("restaurateur_id", profile.id).order("nom"),
    ]);
    setCategories((cats.data ?? []) as Categorie[]);
    setPlats((pls.data ?? []) as Plat[]);
    setLoading(false);
  }, [supa, profile?.id]);

  useEffect(() => { load(); }, [load]);

  async function createCategorie() {
    if (!profile?.id || !newCat.trim()) return;
    const nextOrdre = categories.length;
    const { error } = await supa.from("menu_categories").insert({
      restaurateur_id: profile.id,
      nom:             newCat.trim(),
      ordre:           nextOrdre,
    });
    if (error) { alert(error.message); return; }
    setNewCat("");
    await load();
  }

  async function deleteCategorie(id: string) {
    if (!confirm("Supprimer cette catégorie ? Les plats seront détachés.")) return;
    const { error } = await supa.from("menu_categories").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    await load();
  }

  async function moveCategorie(id: string, dir: -1 | 1) {
    const idx = categories.findIndex(c => c.id === id);
    const target = idx + dir;
    if (target < 0 || target >= categories.length) return;
    const a = categories[idx], b = categories[target];
    await Promise.all([
      supa.from("menu_categories").update({ ordre: b.ordre }).eq("id", a.id),
      supa.from("menu_categories").update({ ordre: a.ordre }).eq("id", b.id),
    ]);
    await load();
  }

  async function createPlat() {
    if (!profile?.id || !newPlatNom.trim()) return;
    const { data, error } = await supa.from("menu_plats").insert({
      restaurateur_id: profile.id,
      nom:             newPlatNom.trim(),
      categorie_id:    newPlatCat || null,
    }).select("id").single();
    if (error || !data) { alert(error?.message ?? "Erreur"); return; }
    // Redirection vers la fiche pour compléter
    window.location.href = `/dashboard/restaurateur/menu/${data.id}`;
  }

  // ── Stats dérivées ──
  const analyse = useMemo(() => {
    const infos = plats.map(p => ({ plat: p, ...margeInfo(p) }));
    const coutMatiereGlobal = infos.reduce((s, i) => s + i.coutUnit, 0);
    const prixHTGlobal      = infos.reduce((s, i) => s + i.prixHT,   0);
    const margeGlobalePct   = prixHTGlobal > 0 ? ((prixHTGlobal - coutMatiereGlobal) / prixHTGlobal) * 100 : 0;

    const withPrix = infos.filter(i => i.prixHT > 0);
    const sortedRentables   = [...withPrix].sort((a, b) => b.margePct - a.margePct);
    const top5Rentables     = sortedRentables.slice(0, 5);
    const top5NonRentables  = sortedRentables.slice(-5).reverse();

    return { infos, coutMatiereGlobal, prixHTGlobal, margeGlobalePct, top5Rentables, top5NonRentables };
  }, [plats]);

  // Groupes par catégorie pour la liste
  const parCategorie = useMemo(() => {
    const groups = new Map<string, { cat: Categorie | null; plats: Plat[] }>();
    categories.forEach(c => groups.set(c.id, { cat: c, plats: [] }));
    groups.set("__none", { cat: null, plats: [] });
    plats.forEach(p => {
      const key = p.categorie_id ?? "__none";
      if (!groups.has(key)) groups.set(key, { cat: null, plats: [] });
      groups.get(key)!.plats.push(p);
    });
    return Array.from(groups.values()).filter(g => g.plats.length > 0 || g.cat);
  }, [plats, categories]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
      <p className="mb-6 text-sm text-gray-500">
        Fiches techniques, coûts de revient et rentabilité.
      </p>

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        ) : (
          <>
            {/* KPIs */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Plats actifs"      value={String(plats.filter(p => p.actif).length)} />
              <Kpi label="Coût matière /portion"  value={fmt(analyse.coutMatiereGlobal)} sub="somme des plats" />
              <Kpi label="Marge brute"       value={`${analyse.margeGlobalePct.toFixed(1)}%`}
                   accent={margeColor(analyse.margeGlobalePct)} />
              <Kpi label="CA HT potentiel/service" value={fmt(analyse.prixHTGlobal)} sub="1 portion de chaque" />
            </div>

            {/* Top 5 rentables / non rentables */}
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-emerald-700">🏆 Top 5 plats les plus rentables</h3>
                {analyse.top5Rentables.length === 0 ? (
                  <p className="text-xs text-gray-500">Pas encore de plat avec prix renseigné.</p>
                ) : (
                  <ul className="divide-y divide-emerald-100">
                    {analyse.top5Rentables.map(i => (
                      <li key={i.plat.id} className="flex items-center justify-between py-2">
                        <Link href={`/dashboard/restaurateur/menu/${i.plat.id}`} className="truncate font-medium text-[#1A1A2E] hover:text-indigo-600">
                          {i.plat.nom}
                        </Link>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {i.margePct.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-2xl border border-rose-200 bg-rose-50/30 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-rose-700">⚠ Top 5 plats les moins rentables</h3>
                {analyse.top5NonRentables.length === 0 ? (
                  <p className="text-xs text-gray-500">Pas encore de données.</p>
                ) : (
                  <ul className="divide-y divide-rose-100">
                    {analyse.top5NonRentables.map(i => (
                      <li key={i.plat.id} className="flex items-center justify-between py-2">
                        <Link href={`/dashboard/restaurateur/menu/${i.plat.id}`} className="truncate font-medium text-[#1A1A2E] hover:text-indigo-600">
                          {i.plat.nom}
                        </Link>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          i.margePct >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                        }`}>
                          {i.margePct.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Création rapide */}
            <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Créer un plat</h3>
              <div className="flex flex-wrap items-end gap-2">
                <input value={newPlatNom} onChange={e => setNewPlatNom(e.target.value)}
                       placeholder="Nom du plat (ex : Blanquette de veau)"
                       className={inputCls + " flex-1 min-w-[220px]"} />
                <select value={newPlatCat} onChange={e => setNewPlatCat(e.target.value)} className={inputCls + " min-w-[180px]"}>
                  <option value="">Sans catégorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                <button onClick={createPlat} disabled={!newPlatNom.trim()}
                        className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                  + Créer & composer
                </button>
              </div>
            </section>

            {/* Liste par catégorie */}
            <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[#1A1A2E]">Mes plats ({plats.length})</h3>
              {parCategorie.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun plat pour l&apos;instant.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {parCategorie.map(g => (
                    <div key={g.cat?.id ?? "none"}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                          {g.cat?.nom ?? "Sans catégorie"}
                        </h4>
                        {g.cat && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveCategorie(g.cat!.id, -1)} className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs hover:bg-gray-50">↑</button>
                            <button onClick={() => moveCategorie(g.cat!.id, 1)}  className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs hover:bg-gray-50">↓</button>
                            <button onClick={() => deleteCategorie(g.cat!.id)}   className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100">Suppr.</button>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {g.plats.map(p => {
                          const info = margeInfo(p);
                          const color = margeColor(info.margePct);
                          const hausse = p.cout_revient_precedent && p.cout_revient_total > 0
                            ? ((p.cout_revient_total - p.cout_revient_precedent) / p.cout_revient_precedent) * 100
                            : 0;
                          return (
                            <Link key={p.id} href={`/dashboard/restaurateur/menu/${p.id}`}
                                  className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-indigo-300 hover:shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate font-semibold text-[#1A1A2E]">{p.nom}</p>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                  color === "emerald" ? "bg-emerald-50 text-emerald-700"
                                  : color === "amber" ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700"
                                }`}>
                                  {p.prix_vente_ttc > 0 ? `${info.margePct.toFixed(0)}%` : "—"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-gray-500">
                                Coût : {fmt(info.coutUnit)} · Prix : {p.prix_vente_ttc > 0 ? fmt(p.prix_vente_ttc) : "—"}
                              </p>
                              {hausse > 5 && (
                                <p className="mt-1 text-[11px] font-medium text-rose-600">
                                  ⚠ +{hausse.toFixed(1)}% de coût matière
                                </p>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Gestion catégories */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Catégories</h3>
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <input value={newCat} onChange={e => setNewCat(e.target.value)}
                       placeholder="Nouvelle catégorie (ex : Entrées)"
                       className={inputCls + " flex-1 min-w-[220px]"} />
                <button onClick={createCategorie} disabled={!newCat.trim()}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:border-indigo-300 disabled:opacity-50">
                  + Ajouter
                </button>
              </div>
              {categories.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune catégorie — commencez par en créer.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <li key={c.id} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm">
                      <span>{c.nom}</span>
                      <button onClick={() => deleteCategorie(c.id)} className="text-xs text-red-500 hover:text-red-700">×</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" | "amber" | "rose" }) {
  const cls = accent === "rose" ? "border-rose-200 bg-rose-50 text-rose-700"
            : accent === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
            : accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-gray-200 bg-white text-[#1A1A2E]";
  const [b, bg, txt] = cls.split(" ");
  return (
    <div className={`rounded-xl border ${b} ${bg} p-3 shadow-sm`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${txt}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-500">{sub}</p>}
    </div>
  );
}
