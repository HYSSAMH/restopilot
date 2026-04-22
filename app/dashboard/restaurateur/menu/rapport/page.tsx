"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt } from "@/lib/gestion-data";

interface Plat {
  id: string;
  nom: string;
  categorie_id: string | null;
  cout_revient_total: number;
  portions_par_recette: number;
  prix_vente_ttc: number;
  tva_taux: number;
  ventes_par_semaine: number;
}
interface Categorie { id: string; nom: string }

type Quadrant = "gagnant" | "risque" | "potentiel" | "action";

interface PlatInfo {
  plat: Plat;
  categorie: string;
  coutUnit: number;
  prixHT: number;
  margePct: number;
  margeEuro: number;
  ventes: number;
  quadrant: Quadrant;
}

const QUADRANTS = {
  gagnant: {
    label: "Produit Gagnant",
    emoji: "🟢",
    color: "#10B981",
    bg:    "bg-emerald-50",
    border:"border-emerald-200",
    text:  "text-emerald-700",
    desc:  "Grosse marge + Gros volume",
    reco:  "Mettez ces plats en avant sur la carte, en photo. Ce sont vos locomotives — à protéger contre la hausse des coûts.",
  },
  risque: {
    label: "Produit à Risque",
    emoji: "🔴",
    color: "#EF4444",
    bg:    "bg-rose-50",
    border:"border-rose-200",
    text:  "text-rose-700",
    desc:  "Petite marge + Gros volume",
    reco:  "Ces plats se vendent bien mais rapportent peu. Revoyez le prix (+10-15 %) ou réduisez les coûts ingrédients. Un effort ici a un impact énorme.",
  },
  potentiel: {
    label: "Fort Potentiel",
    emoji: "🟡",
    color: "#F59E0B",
    bg:    "bg-amber-50",
    border:"border-amber-200",
    text:  "text-amber-700",
    desc:  "Grosse marge + Petit volume",
    reco:  "Ces plats méritent plus de visibilité : mise en avant serveurs, suggestion du chef, photos, positionnement sur la carte.",
  },
  action: {
    label: "Action Immédiate",
    emoji: "⚫",
    color: "#6B7280",
    bg:    "bg-gray-100",
    border:"border-gray-300",
    text:  "text-gray-700",
    desc:  "Petite marge + Petit volume",
    reco:  "À reformuler, repricer, ou supprimer de la carte. Ils occupent une ligne sans contribuer. Libérez la place.",
  },
} as const;

const inputCls = "min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

export default function RapportMargePage() {
  const { profile } = useProfile();
  const supa = useMemo(() => createClient(), []);
  const [plats, setPlats]           = useState<Plat[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      supa.from("menu_plats")
          .select("id, nom, categorie_id, cout_revient_total, portions_par_recette, prix_vente_ttc, tva_taux, ventes_par_semaine")
          .eq("restaurateur_id", profile.id)
          .eq("actif", true),
      supa.from("menu_categories").select("id, nom").eq("restaurateur_id", profile.id),
    ]);
    setPlats((pRes.data ?? []) as Plat[]);
    setCategories((cRes.data ?? []) as Categorie[]);
    setLoading(false);
  }, [supa, profile?.id]);

  useEffect(() => { load(); }, [load]);

  async function updateVentes(platId: string, ventes: number) {
    const { error } = await supa.from("menu_plats").update({ ventes_par_semaine: ventes }).eq("id", platId);
    if (error) { alert(error.message); return; }
    setPlats(prev => prev.map(p => p.id === platId ? { ...p, ventes_par_semaine: ventes } : p));
  }

  // ── Calcul BCG ──
  const analyse = useMemo(() => {
    const raw = plats
      .filter(p => p.prix_vente_ttc > 0)
      .map(p => {
        const coutUnit = p.portions_par_recette > 0 ? Number(p.cout_revient_total) / p.portions_par_recette : 0;
        const prixHT   = Number(p.prix_vente_ttc) / (1 + Number(p.tva_taux) / 100);
        const margePct = prixHT > 0 ? ((prixHT - coutUnit) / prixHT) * 100 : 0;
        const margeEuro = prixHT - coutUnit;
        const ventes = Number(p.ventes_par_semaine);
        return { plat: p, coutUnit, prixHT, margePct, margeEuro, ventes };
      });

    // Médianes pour définir les seuils
    const margeValues = raw.map(r => r.margePct).sort((a, b) => a - b);
    const ventesValues = raw.map(r => r.ventes).sort((a, b) => a - b);
    const medianMarge  = margeValues.length > 0
      ? margeValues[Math.floor(margeValues.length / 2)] : 60;
    const medianVentes = ventesValues.length > 0
      ? ventesValues[Math.floor(ventesValues.length / 2)] : 10;
    // Si toutes les ventes sont à 0, on force un seuil arbitraire pour éviter que tout atterrisse au même endroit
    const thrVentes = medianVentes > 0 ? medianVentes : 1;
    const thrMarge  = medianMarge;

    const infos: PlatInfo[] = raw.map(r => {
      const highMarge  = r.margePct >= thrMarge;
      const highVolume = r.ventes   >= thrVentes;
      const quadrant: Quadrant = highMarge && highVolume  ? "gagnant"
                                : !highMarge && highVolume ? "risque"
                                : highMarge && !highVolume ? "potentiel"
                                :                            "action";
      return {
        ...r,
        categorie: categories.find(c => c.id === r.plat.categorie_id)?.nom ?? "Sans catégorie",
        quadrant,
      };
    });

    const byQuadrant: Record<Quadrant, PlatInfo[]> = {
      gagnant: [], risque: [], potentiel: [], action: [],
    };
    infos.forEach(i => byQuadrant[i.quadrant].push(i));
    return { infos, byQuadrant, thrMarge, thrVentes };
  }, [plats, categories]);

  async function exportPdf() {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const M = 14;
      const dateStr = new Date().toLocaleDateString("fr-FR");

      // Header
      doc.setFillColor(26, 26, 46);
      doc.rect(0, 0, 210, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("RestoPilot — Rapport marge / volume", M, 13);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`Généré le ${dateStr}`, 210 - M, 13, { align: "right" });

      let y = 30;
      doc.setTextColor(26, 26, 46);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text(`${analyse.infos.length} plats analysés`, M, y);
      y += 6;
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`Seuils médians — Marge : ${analyse.thrMarge.toFixed(1)} % · Volume : ${analyse.thrVentes.toFixed(0)} ventes/sem.`, M, y);
      y += 10;

      // Sections par quadrant
      (["gagnant","risque","potentiel","action"] as Quadrant[]).forEach(q => {
        const list = analyse.byQuadrant[q];
        const info = QUADRANTS[q];
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 26, 46);
        doc.text(`${info.emoji} ${info.label} (${list.length})`, M, y);
        y += 5;
        doc.setFontSize(7); doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 120);
        const reco = doc.splitTextToSize(info.reco, 180);
        doc.text(reco, M, y);
        y += reco.length * 3.5 + 2;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 60);
        if (list.length === 0) {
          doc.text("— Aucun plat dans ce quadrant.", M + 2, y);
          y += 6;
        } else {
          list.forEach(i => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.setFontSize(8);
            doc.text(`• ${i.plat.nom}`, M + 2, y);
            doc.text(
              `marge ${i.margePct.toFixed(1)} % · ${i.ventes.toFixed(0)} ventes/sem · ${(i.margeEuro * i.ventes * 4.33).toFixed(0)} € marge mens.`,
              210 - M, y, { align: "right" },
            );
            y += 4;
          });
          y += 3;
        }
      });

      doc.save(`rapport-marge-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      alert("Erreur PDF : " + (e instanceof Error ? e.message : String(e)));
    }
    setGenerating(false);
  }

  // Scatter data pour Recharts
  const scatterData = analyse.infos.map(i => ({
    x: i.ventes,
    y: i.margePct,
    z: 200,
    nom: i.plat.nom,
    id: i.plat.id,
    color: QUADRANTS[i.quadrant].color,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Matrice BCG : marge % vs volume de ventes — pour prioriser vos actions.</p>
        <button onClick={exportPdf} disabled={generating || analyse.infos.length === 0}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:border-indigo-300 disabled:opacity-50">
          {generating ? "Génération…" : "↓ Export PDF"}
        </button>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      ) : analyse.infos.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-lg font-semibold text-[#1A1A2E]">Aucun plat à analyser</p>
          <p className="mt-1 text-sm text-gray-500">
            Créez au moins une fiche technique avec un prix de vente pour voir apparaître la matrice.
          </p>
          <Link href="/dashboard/restaurateur/menu"
                className="mt-4 inline-block rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white">
            ← Aller au menu
          </Link>
        </div>
      ) : (
        <>
          {/* Matrice */}
          <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-medium text-gray-600">
              Matrice — chaque point est un plat (médiane marge : {analyse.thrMarge.toFixed(1)} % · médiane ventes : {analyse.thrVentes.toFixed(0)}/sem)
            </p>
            <div style={{ width: "100%", height: 380 }}>
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" dataKey="x" name="Ventes / semaine"
                         tick={{ fontSize: 11, fill: "#6B7280" }}
                         label={{ value: "Ventes / semaine →", position: "insideBottom", offset: -10, fontSize: 11, fill: "#6B7280" }} />
                  <YAxis type="number" dataKey="y" name="Marge %" unit="%"
                         tick={{ fontSize: 11, fill: "#6B7280" }}
                         label={{ value: "Marge %", angle: -90, position: "insideLeft", fontSize: 11, fill: "#6B7280" }} />
                  <ZAxis type="number" dataKey="z" range={[100, 250]} />
                  <ReferenceLine x={analyse.thrVentes} stroke="#A5B4FC" strokeDasharray="3 3" />
                  <ReferenceLine y={analyse.thrMarge}  stroke="#A5B4FC" strokeDasharray="3 3" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { nom: string; x: number; y: number };
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-md">
                          <p className="font-semibold text-[#1A1A2E]">{p.nom}</p>
                          <p className="text-gray-600">Marge : {p.y.toFixed(1)} %</p>
                          <p className="text-gray-600">{p.x.toFixed(0)} ventes/sem</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData} shape="circle">
                    {scatterData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Quadrants avec recommandations */}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {(["gagnant","risque","potentiel","action"] as Quadrant[]).map(q => {
              const info = QUADRANTS[q];
              const list = analyse.byQuadrant[q];
              return (
                <section key={q} className={`rounded-2xl border ${info.border} ${info.bg} p-5 shadow-sm`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xl">{info.emoji}</span>
                    <h3 className={`text-sm font-bold ${info.text}`}>{info.label}</h3>
                    <span className={`ml-auto rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold ${info.text}`}>
                      {list.length} plat{list.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className={`text-xs font-medium ${info.text}`}>{info.desc}</p>
                  <p className="mt-1 text-xs text-gray-700">{info.reco}</p>
                  {list.length > 0 && (
                    <ul className="mt-3 divide-y divide-white/50">
                      {list.slice(0, 8).map(i => (
                        <li key={i.plat.id} className="flex items-center justify-between gap-2 py-1">
                          <Link href={`/dashboard/restaurateur/menu/${i.plat.id}`}
                                className="truncate text-sm font-medium text-[#1A1A2E] hover:text-indigo-600">
                            {i.plat.nom}
                          </Link>
                          <span className="shrink-0 text-xs text-gray-600">
                            {i.margePct.toFixed(0)}% · {i.ventes.toFixed(0)}/sem
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {/* Table ventes (saisie rapide) */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Mettre à jour les volumes de ventes</h3>
            <p className="mb-3 text-xs text-gray-500">Saisissez le nombre de ventes moyennes par semaine pour chaque plat. Le classement BCG se met à jour en direct.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 text-left">Plat</th>
                    <th className="px-3 py-2 text-left">Catégorie</th>
                    <th className="px-3 py-2 text-right">Prix TTC</th>
                    <th className="px-3 py-2 text-right">Marge %</th>
                    <th className="px-3 py-2 text-right">Marge €</th>
                    <th className="px-3 py-2 text-right">Ventes/sem</th>
                    <th className="px-3 py-2 text-right">Marge mens.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {analyse.infos.map(i => (
                    <tr key={i.plat.id}>
                      <td className="px-3 py-2">
                        <Link href={`/dashboard/restaurateur/menu/${i.plat.id}`}
                              className="font-medium text-[#1A1A2E] hover:text-indigo-600">{i.plat.nom}</Link>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{i.categorie}</td>
                      <td className="px-3 py-2 text-right">{fmt(Number(i.plat.prix_vente_ttc))}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        i.margePct >= 70 ? "text-emerald-600" : i.margePct >= 50 ? "text-amber-600" : "text-rose-600"
                      }`}>{i.margePct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">{fmt(i.margeEuro)}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="0" step="1" defaultValue={i.ventes}
                               onBlur={e => {
                                 const v = parseFloat(e.target.value) || 0;
                                 if (v !== i.ventes) updateVentes(i.plat.id, v);
                               }}
                               className={inputCls + " w-20 text-right"} />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-600">
                        {fmt(i.margeEuro * i.ventes * 4.33)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
