"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt } from "@/lib/gestion-data";

// ── Types ─────────────────────────────────────────────────────────────

interface Categorie { id: string; nom: string }
interface Plat {
  id: string;
  categorie_id: string | null;
  nom: string;
  description: string | null;
  photo_url: string | null;
  temps_preparation_min: number | null;
  allergenes: string[];
  portions_par_recette: number;
  instructions: string | null;
  tva_taux: number;
  marge_souhaitee_pct: number;
  prix_vente_ttc: number;
  cout_revient_total: number;
  cout_revient_precedent: number | null;
  cout_revient_calcule_at: string | null;
  popularite_score: number;
  actif: boolean;
}
interface Ingredient {
  id: string;
  plat_id: string;
  tarif_id: string | null;
  produit_id: string | null;
  nom: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  cout_total: number;
  prix_precedent: number | null;
  prix_derniere_maj: string | null;
  ordre: number;
}
interface TarifOption {
  id: string;
  prix: number;
  unite: string;
  produit_id: string;
  produit_nom: string;
  fournisseur_nom: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────

const ALLERGENES_UE = [
  "Gluten","Crustacés","Œufs","Poissons","Arachides","Soja","Lait",
  "Fruits à coque","Céleri","Moutarde","Sésame","Sulfites","Lupin","Mollusques",
];
const TVA_OPTIONS = [
  { value: 5.5, label: "5,5 % (produits alimentaires à emporter)" },
  { value: 10,  label: "10 % (restauration sur place)" },
  { value: 20,  label: "20 % (alcool, boissons)" },
];
const inputCls = "min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

// ── Page ──────────────────────────────────────────────────────────────

export default function FicheTechniquePage() {
  const router  = useRouter();
  const params  = useParams<{ plat_id: string }>();
  const platId  = params?.plat_id;
  const { profile } = useProfile();
  const supa    = useMemo(() => createClient(), []);

  const [plat, setPlat]               = useState<Plat | null>(null);
  const [categories, setCategories]   = useState<Categorie[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [tarifs, setTarifs]           = useState<TarifOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving,  setSaving]          = useState(false);
  const [toast,   setToast]           = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Form local pour le plat (édité en place puis bouton Save)
  const [form, setForm] = useState<Plat | null>(null);

  // Simulation
  const [portionsParJour, setPortionsJour] = useState<number>(10);

  // Recherche mercuriale
  const [search, setSearch] = useState("");

  // ── Load ──
  const load = useCallback(async () => {
    if (!platId || !profile?.id) return;
    setLoading(true);
    const [pRes, cRes, iRes, tRes] = await Promise.all([
      supa.from("menu_plats").select("*").eq("id", platId).maybeSingle(),
      supa.from("menu_categories").select("*").eq("restaurateur_id", profile.id).order("ordre"),
      supa.from("fiche_ingredients").select("*").eq("plat_id", platId).order("ordre"),
      supa.from("tarifs")
          .select("id, prix, unite, produit_id, produits(nom), fournisseurs(nom)")
          .eq("actif", true),
    ]);
    if (!pRes.data) {
      setToast({ type: "error", msg: "Plat introuvable." });
      setLoading(false);
      return;
    }
    const p = pRes.data as Plat;
    setPlat(p);
    setForm(p);
    setCategories((cRes.data ?? []) as Categorie[]);
    setIngredients((iRes.data ?? []) as Ingredient[]);

    type TarifRaw = {
      id: string; prix: number; unite: string; produit_id: string;
      produits: { nom: string } | null;
      fournisseurs: { nom: string } | null;
    };
    const opts: TarifOption[] = ((tRes.data ?? []) as unknown as TarifRaw[]).map((t) => ({
      id: t.id, prix: Number(t.prix), unite: t.unite, produit_id: t.produit_id,
      produit_nom: t.produits?.nom ?? "—",
      fournisseur_nom: t.fournisseurs?.nom ?? null,
    }));
    setTarifs(opts);
    setLoading(false);
  }, [supa, platId, profile?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Save plat ──
  async function saveForm() {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        categorie_id:          form.categorie_id,
        nom:                   form.nom.trim(),
        description:           form.description,
        photo_url:             form.photo_url,
        temps_preparation_min: form.temps_preparation_min,
        allergenes:            form.allergenes,
        portions_par_recette:  Math.max(1, Number(form.portions_par_recette) || 1),
        instructions:          form.instructions,
        tva_taux:              Number(form.tva_taux) || 10,
        marge_souhaitee_pct:   Number(form.marge_souhaitee_pct) || 0,
        prix_vente_ttc:        Number(form.prix_vente_ttc) || 0,
        popularite_score:      Number(form.popularite_score) || 0,
        actif:                 form.actif,
      };
      const { error } = await supa.from("menu_plats").update(payload).eq("id", form.id);
      if (error) throw new Error(error.message);
      setToast({ type: "success", msg: "Fiche enregistrée." });
      await load();
    } catch (e) {
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Erreur" });
    }
    setSaving(false);
  }

  // ── Photo upload ──
  async function handlePhoto(file: File) {
    if (!profile?.id || !plat) return;
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profile.id}/${plat.id}.${ext}`;
      const { error: upErr } = await supa.storage.from("menu-photos").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw new Error(upErr.message);
      const { data } = supa.storage.from("menu-photos").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      await supa.from("menu_plats").update({ photo_url: url }).eq("id", plat.id);
      setForm(f => f ? { ...f, photo_url: url } : f);
      setToast({ type: "success", msg: "Photo mise à jour." });
    } catch (e) {
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Upload échoué" });
    }
  }

  // ── Ingredients ──
  async function addIngredientFromTarif(t: TarifOption) {
    if (!plat) return;
    const { error } = await supa.from("fiche_ingredients").insert({
      plat_id:       plat.id,
      tarif_id:      t.id,
      produit_id:    t.produit_id,
      nom:           t.produit_nom,
      quantite:      1,
      unite:         t.unite,
      prix_unitaire: t.prix,
      ordre:         ingredients.length,
    });
    if (error) { setToast({ type: "error", msg: error.message }); return; }
    setSearch("");
    await load();
  }

  async function addIngredientManual() {
    if (!plat) return;
    const nom = prompt("Nom de l'ingrédient :");
    if (!nom) return;
    const prix = parseFloat(prompt("Prix unitaire (€) :", "0") ?? "0") || 0;
    const unite = prompt("Unité (kg, L, pièce…) :", "kg") || "kg";
    const { error } = await supa.from("fiche_ingredients").insert({
      plat_id:       plat.id,
      nom,
      quantite:      1,
      unite,
      prix_unitaire: prix,
      ordre:         ingredients.length,
    });
    if (error) { setToast({ type: "error", msg: error.message }); return; }
    await load();
  }

  async function updateIngredient(ing: Ingredient, patch: Partial<Ingredient>) {
    const { error } = await supa.from("fiche_ingredients").update(patch).eq("id", ing.id);
    if (error) { setToast({ type: "error", msg: error.message }); return; }
    await load();
  }

  async function deleteIngredient(id: string) {
    const { error } = await supa.from("fiche_ingredients").delete().eq("id", id);
    if (error) { setToast({ type: "error", msg: error.message }); return; }
    await load();
  }

  // ── Sync prix mercuriale ──
  async function syncPrix() {
    const linked = ingredients.filter(i => i.tarif_id);
    if (linked.length === 0) {
      setToast({ type: "error", msg: "Aucun ingrédient lié à la mercuriale." });
      return;
    }
    setSaving(true);
    try {
      let updated = 0;
      let alerts = 0;
      for (const ing of linked) {
        const { data: tr } = await supa.from("tarifs").select("prix").eq("id", ing.tarif_id!).maybeSingle();
        const newPrix = Number(tr?.prix ?? 0);
        if (newPrix === 0 || newPrix === Number(ing.prix_unitaire)) continue;
        const delta = Number(ing.prix_unitaire) > 0 ? ((newPrix - Number(ing.prix_unitaire)) / Number(ing.prix_unitaire)) * 100 : 0;
        if (Math.abs(delta) > 5) alerts += 1;
        await supa.from("fiche_ingredients").update({
          prix_precedent:      ing.prix_unitaire,
          prix_unitaire:       newPrix,
          prix_derniere_maj:   new Date().toISOString(),
        }).eq("id", ing.id);
        updated += 1;
      }
      setToast({
        type: "success",
        msg: updated === 0
          ? "Aucun prix n'a changé."
          : `${updated} ingrédient(s) mis à jour${alerts > 0 ? ` — ${alerts} alerte(s) > 5 %` : ""}.`,
      });
      await load();
    } catch (e) {
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Erreur sync" });
    }
    setSaving(false);
  }

  // ── Delete plat ──
  async function deletePlat() {
    if (!plat) return;
    if (!confirm(`Supprimer "${plat.nom}" et ses ingrédients ?`)) return;
    await supa.from("menu_plats").delete().eq("id", plat.id);
    router.push("/dashboard/restaurateur/menu");
  }

  // ── Calculs ──
  const coutUnit = plat && plat.portions_par_recette > 0 ? plat.cout_revient_total / plat.portions_par_recette : 0;
  const prixHT   = form && form.prix_vente_ttc > 0 ? form.prix_vente_ttc / (1 + form.tva_taux / 100) : 0;
  const margePct = prixHT > 0 ? ((prixHT - coutUnit) / prixHT) * 100 : 0;
  // Prix conseillé à partir de la marge souhaitée : marge_pct = (prix_ht - cout) / prix_ht → prix_ht = cout / (1 - marge%/100)
  const mSh      = form ? Number(form.marge_souhaitee_pct) / 100 : 0.7;
  const prixConseilleHT  = mSh < 1 ? coutUnit / (1 - mSh) : 0;
  const prixConseilleTTC = form ? prixConseilleHT * (1 + form.tva_taux / 100) : 0;

  const simCA      = portionsParJour * (form?.prix_vente_ttc ?? 0);
  const simCoutMat = portionsParJour * coutUnit;
  const simMarge   = simCA / (form ? (1 + form.tva_taux / 100) : 1) - simCoutMat;

  // Filtre recherche mercuriale
  const tarifsFiltered = useMemo(() => {
    if (!search.trim()) return tarifs.slice(0, 20);
    const s = search.toLowerCase();
    return tarifs.filter(t =>
      t.produit_nom.toLowerCase().includes(s) || (t.fournisseur_nom ?? "").toLowerCase().includes(s)
    ).slice(0, 20);
  }, [tarifs, search]);

  // Alertes hausse > 5% sur ingrédients
  const alertesHausse = ingredients
    .filter(i => i.prix_precedent && i.prix_precedent > 0)
    .map(i => ({
      nom: i.nom,
      deltaPct: ((Number(i.prix_unitaire) - Number(i.prix_precedent)) / Number(i.prix_precedent)) * 100,
    }))
    .filter(a => Math.abs(a.deltaPct) > 5);

  if (loading || !plat || !form) {
    return (
      <DashboardLayout role="restaurateur">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        {/* Breadcrumb */}
        <Link href="/dashboard/restaurateur/menu"
              className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-indigo-300">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour au menu
        </Link>

        {/* Alertes */}
        {alertesHausse.length > 0 && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">⚠ Ingrédient(s) avec variation &gt; 5 % :</p>
            <ul className="mt-1 list-disc pl-5">
              {alertesHausse.map((a, i) => (
                <li key={i}>{a.nom} : {a.deltaPct > 0 ? "+" : ""}{a.deltaPct.toFixed(1)} %</li>
              ))}
            </ul>
          </div>
        )}

        {/* Header plat */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
              {form.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photo_url} alt={form.nom} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">🍽️</div>
              )}
              <label className="absolute inset-0 cursor-pointer opacity-0 hover:opacity-100 bg-black/40 flex items-center justify-center text-xs text-white">
                <input type="file" accept="image/*" hidden
                       onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.currentTarget.value = ""; }} />
                Modifier
              </label>
            </div>
            <div className="flex-1 min-w-[240px]">
              <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                     className={inputCls + " w-full text-lg font-semibold"} />
              <div className="mt-2 flex flex-wrap gap-2">
                <select value={form.categorie_id ?? ""} onChange={e => setForm({ ...form, categorie_id: e.target.value || null })} className={inputCls}>
                  <option value="">Sans catégorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Portions</span>
                  <input type="number" min="1" value={form.portions_par_recette}
                         onChange={e => setForm({ ...form, portions_par_recette: parseInt(e.target.value) || 1 })}
                         className={inputCls + " w-20"} />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Temps (min)</span>
                  <input type="number" min="0" value={form.temps_preparation_min ?? ""}
                         onChange={e => setForm({ ...form, temps_preparation_min: e.target.value ? parseInt(e.target.value) : null })}
                         className={inputCls + " w-20"} />
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={form.actif} onChange={e => setForm({ ...form, actif: e.target.checked })} />
                  <span className="text-xs">Actif</span>
                </label>
              </div>
            </div>
          </div>
          <textarea value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={2} placeholder="Description (pour la carte)"
                    className={inputCls + " mt-3 w-full"} />
        </section>

        {/* Allergènes */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Allergènes</h3>
          <div className="flex flex-wrap gap-2">
            {ALLERGENES_UE.map(a => {
              const on = form.allergenes.includes(a);
              return (
                <button key={a}
                        onClick={() => setForm({ ...form, allergenes: on ? form.allergenes.filter(x => x !== a) : [...form.allergenes, a] })}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          on ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"
                        }`}>
                  {a}
                </button>
              );
            })}
          </div>
        </section>

        {/* Ingrédients */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">Ingrédients ({ingredients.length})</h3>
            <div className="flex gap-2">
              <button onClick={syncPrix} disabled={saving}
                      className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                🔄 Mettre à jour les prix
              </button>
              <button onClick={addIngredientManual}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-indigo-300">
                + Ingrédient manuel
              </button>
            </div>
          </div>

          {/* Recherche mercuriale */}
          <div className="mb-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
                   placeholder="🔍 Ajouter depuis la mercuriale (nom du produit ou fournisseur)…"
                   className={inputCls + " w-full"} />
            {search.trim().length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white">
                {tarifsFiltered.length === 0 ? (
                  <p className="p-3 text-xs text-gray-500">Aucun produit trouvé.</p>
                ) : (
                  tarifsFiltered.map(t => (
                    <button key={t.id} onClick={() => addIngredientFromTarif(t)}
                            className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-indigo-50 last:border-b-0">
                      <div>
                        <p className="font-medium text-[#1A1A2E]">{t.produit_nom}</p>
                        <p className="text-xs text-gray-500">{t.fournisseur_nom} · {t.unite}</p>
                      </div>
                      <span className="text-sm font-semibold text-indigo-600">{fmt(t.prix)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Liste */}
          {ingredients.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun ingrédient pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-2 py-2 text-left">Ingrédient</th>
                    <th className="px-2 py-2 text-right">Qté</th>
                    <th className="px-2 py-2 text-left">Unité</th>
                    <th className="px-2 py-2 text-right">Prix unit.</th>
                    <th className="px-2 py-2 text-right">Coût</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ingredients.map(i => (
                    <tr key={i.id} className={i.tarif_id ? "" : "bg-gray-50/50"}>
                      <td className="px-2 py-1.5">
                        <input defaultValue={i.nom} onBlur={e => {
                          const v = e.target.value.trim();
                          if (v && v !== i.nom) updateIngredient(i, { nom: v });
                        }} className={inputCls + " w-full"} />
                        {i.tarif_id && <p className="mt-0.5 text-[10px] text-indigo-600">🔗 lié mercuriale</p>}
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.001" defaultValue={i.quantite}
                               onBlur={e => {
                                 const v = parseFloat(e.target.value) || 0;
                                 if (v !== Number(i.quantite)) updateIngredient(i, { quantite: v });
                               }} className={inputCls + " w-20 text-right"} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input defaultValue={i.unite} onBlur={e => {
                          const v = e.target.value.trim();
                          if (v !== i.unite) updateIngredient(i, { unite: v });
                        }} className={inputCls + " w-16"} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" defaultValue={i.prix_unitaire}
                               onBlur={e => {
                                 const v = parseFloat(e.target.value) || 0;
                                 if (v !== Number(i.prix_unitaire)) updateIngredient(i, { prix_unitaire: v });
                               }} className={inputCls + " w-24 text-right"} />
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-[#1A1A2E]">{fmt(Number(i.cout_total))}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => deleteIngredient(i.id)}
                                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-2 py-2 text-right text-sm font-semibold">Coût total recette :</td>
                    <td className="px-2 py-2 text-right font-bold text-[#1A1A2E]">{fmt(Number(plat.cout_revient_total))}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-2 py-1 text-right text-xs text-gray-500">Coût par portion ({plat.portions_par_recette}) :</td>
                    <td className="px-2 py-1 text-right font-semibold text-indigo-600">{fmt(coutUnit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Tarification */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Tarification</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">TVA</span>
              <select value={form.tva_taux} onChange={e => setForm({ ...form, tva_taux: parseFloat(e.target.value) })} className={inputCls}>
                {TVA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Marge souhaitée (% sur prix HT)</span>
              <input type="number" min="0" max="95" step="0.5" value={form.marge_souhaitee_pct}
                     onChange={e => setForm({ ...form, marge_souhaitee_pct: parseFloat(e.target.value) || 0 })}
                     className={inputCls} />
            </label>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:col-span-2">
              <p className="text-xs text-emerald-700">Prix conseillé TTC (pour marge {form.marge_souhaitee_pct}%) :</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-2xl font-bold text-emerald-700">{fmt(prixConseilleTTC)}</p>
                <button onClick={() => setForm({ ...form, prix_vente_ttc: Math.round(prixConseilleTTC * 100) / 100 })}
                        className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                  Appliquer
                </button>
              </div>
            </div>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Prix de vente TTC affiché</span>
              <input type="number" min="0" step="0.01" value={form.prix_vente_ttc}
                     onChange={e => setForm({ ...form, prix_vente_ttc: parseFloat(e.target.value) || 0 })}
                     className={inputCls + " text-lg font-semibold"} />
            </label>
          </div>

          {/* Indicateur marge actuelle */}
          {form.prix_vente_ttc > 0 && (
            <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
              margePct >= 70 ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : margePct >= 50 ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
            }`}>
              Marge actuelle : <span className="font-bold">{margePct.toFixed(1)}%</span>{" "}
              (HT : {fmt(prixHT)} · coût : {fmt(coutUnit)} · marge € : {fmt(prixHT - coutUnit)})
            </div>
          )}
        </section>

        {/* Simulation */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Simulation de rentabilité</h3>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Portions vendues par jour</span>
            <input type="number" min="0" value={portionsParJour}
                   onChange={e => setPortionsJour(parseInt(e.target.value) || 0)}
                   className={inputCls + " w-32"} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <SimCard label="Par jour"    ca={simCA}      cm={simCoutMat}      marge={simMarge} />
            <SimCard label="Par semaine" ca={simCA * 7}  cm={simCoutMat * 7}  marge={simMarge * 7} />
            <SimCard label="Par mois"    ca={simCA * 30} cm={simCoutMat * 30} marge={simMarge * 30} />
          </div>
        </section>

        {/* Instructions */}
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Notes et instructions</h3>
          <textarea value={form.instructions ?? ""} onChange={e => setForm({ ...form, instructions: e.target.value })}
                    rows={4} placeholder="Étapes de préparation, astuces, conseils de service…"
                    className={inputCls + " w-full"} />
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={deletePlat}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">
            Supprimer ce plat
          </button>
          <button onClick={saveForm} disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50">
            {saving ? "Enregistrement…" : "💾 Enregistrer la fiche"}
          </button>
        </div>

        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-2xl border px-4 py-3 shadow-2xl ${
            toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>
            <p className="text-sm font-medium">{toast.msg}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SimCard({ label, ca, cm, marge }: { label: string; ca: number; cm: number; marge: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-xs text-gray-600">CA TTC : <span className="font-bold text-[#1A1A2E]">{fmt(ca)}</span></p>
      <p className="text-xs text-gray-600">Coût matières : <span className="font-semibold text-rose-600">{fmt(cm)}</span></p>
      <p className="text-xs text-gray-600">Marge brute : <span className="font-semibold text-emerald-600">{fmt(marge)}</span></p>
    </div>
  );
}
