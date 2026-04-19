"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { generateAvoirPDF, type AvoirData } from "@/lib/avoir-pdf";

interface Line {
  id: string;
  nom_snapshot: string;
  unite: string;
  prix_snapshot: number;
  quantite: number;
  quantite_recue: number | null;
  qualite: "conforme" | "non_conforme" | null;
  motif_anomalie: string | null;
}

interface Commande {
  id: string;
  fournisseur_id: string;
  montant_total: number;
  created_at: string;
  lignes_commande: Line[];
}

interface FournProfile {
  id: string;
  nom_commercial: string | null;
  nom_etablissement: string | null;
  raison_sociale: string | null;
  siret: string | null;
  adresse_ligne1: string | null;
  code_postal: string | null;
  ville: string | null;
}

interface LineState extends Line {
  editQte: string;
  editQualite: "conforme" | "non_conforme";
  editMotif: string;
}

const MOTIFS = ["Abîmé", "Manquant", "Mauvaise qualité", "Périmé", "Erreur produit"];

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function ReceptionsPage() {
  const { profile } = useProfile();
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [fournMap, setFournMap]     = useState<Record<string, FournProfile>>({});
  const [loading, setLoading]       = useState(true);
  const [openId, setOpenId]         = useState<string | null>(null);
  const [lines, setLines]           = useState<Record<string, LineState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchCommandes = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("commandes")
      .select(`
        id, fournisseur_id, montant_total, created_at,
        lignes_commande ( id, nom_snapshot, unite, prix_snapshot, quantite, quantite_recue, qualite, motif_anomalie )
      `)
      .eq("restaurateur_id", user.id)
      .eq("statut", "livree")
      .is("receptionnee_at", null)
      .order("created_at", { ascending: false });

    const typed = (data ?? []) as unknown as Commande[];
    setCommandes(typed);

    const ids = Array.from(new Set(typed.map(c => c.fournisseur_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nom_commercial, nom_etablissement, raison_sociale, siret, adresse_ligne1, code_postal, ville")
        .in("id", ids);
      const map: Record<string, FournProfile> = {};
      (profs ?? []).forEach(p => { map[p.id] = p as FournProfile; });
      setFournMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCommandes(); }, [fetchCommandes]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function openCommande(c: Commande) {
    setOpenId(c.id);
    const map: Record<string, LineState> = {};
    c.lignes_commande.forEach(l => {
      map[l.id] = {
        ...l,
        editQte:     (l.quantite_recue ?? l.quantite).toString(),
        editQualite: l.qualite ?? "conforme",
        editMotif:   l.motif_anomalie ?? "",
      };
    });
    setLines(map);
  }

  function updateLine(id: string, patch: Partial<LineState>) {
    setLines(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleValidate(c: Commande) {
    setSubmitting(true);
    const supabase = createClient();
    try {
      let hasAnomalie = false;
      let avoirMontant = 0;
      const avoirLignes: AvoirData["lignes"] = [];

      // 1. Mettre à jour chaque ligne
      for (const l of c.lignes_commande) {
        const ls = lines[l.id];
        const qteRecue = parseFloat(ls.editQte);
        const qualite  = ls.editQualite;
        const motif    = qualite === "non_conforme" ? ls.editMotif.trim() : null;

        if (qualite === "non_conforme" && !motif) {
          throw new Error(`Motif requis pour la ligne "${l.nom_snapshot}".`);
        }

        const anomalie = qteRecue < l.quantite || qualite === "non_conforme";
        if (anomalie) {
          hasAnomalie = true;
          const ecart = Math.max(0, l.quantite - qteRecue);
          const montant = qualite === "non_conforme"
            ? l.quantite * l.prix_snapshot     // remboursement total ligne
            : ecart * l.prix_snapshot;          // juste l'écart quantitatif
          avoirMontant += montant;
          if (montant > 0) {
            avoirLignes.push({
              nom:           l.nom_snapshot,
              unite:         l.unite,
              prix_unitaire: l.prix_snapshot,
              qte_commandee: l.quantite,
              qte_recue:     qualite === "non_conforme" ? 0 : qteRecue,
              motif:         qualite === "non_conforme" ? motif : "Manquant",
            });
          }
        }

        await supabase.from("lignes_commande").update({
          quantite_recue: qteRecue,
          qualite,
          motif_anomalie: motif,
        }).eq("id", l.id);
      }

      // 2. Update commande
      await supabase.from("commandes").update({
        statut:          hasAnomalie ? "receptionnee_avec_anomalies" : "receptionnee",
        receptionnee_at: new Date().toISOString(),
        avoir_montant:   Math.round(avoirMontant * 100) / 100,
        avoir_statut:    hasAnomalie ? "en_attente" : null,
      }).eq("id", c.id);

      // 3. Si anomalies → générer l'avoir PDF
      if (hasAnomalie && avoirLignes.length > 0) {
        const f = fournMap[c.fournisseur_id];
        const ref = `AV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
        await generateAvoirPDF({
          reference:   ref,
          commandeRef: c.id.slice(0, 8).toUpperCase(),
          date:        new Date().toLocaleDateString("fr-FR"),
          lignes:      avoirLignes,
          buyer: {
            nom:      profile?.nom_commercial || profile?.nom_etablissement || "Restaurateur",
            raison:   profile?.raison_sociale ?? null,
            siret:    profile?.siret ?? null,
            adresse:  profile?.adresse_ligne1 ?? null,
            cp_ville: [profile?.code_postal, profile?.ville].filter(Boolean).join(" ") || null,
          },
          seller: f ? {
            nom:      f.nom_commercial || f.nom_etablissement || "Fournisseur",
            raison:   f.raison_sociale,
            siret:    f.siret,
            adresse:  f.adresse_ligne1,
            cp_ville: [f.code_postal, f.ville].filter(Boolean).join(" ") || null,
          } : null,
        });
      }

      setOpenId(null);
      setToast({
        type: "success",
        msg: hasAnomalie
          ? `Réception validée avec anomalies. Avoir de ${fmt(avoirMontant)} généré.`
          : "Réception validée. Aucune anomalie constatée.",
      });
      fetchCommandes();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setToast({ type: "error", msg });
    }
    setSubmitting(false);
  }

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">À réceptionner</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A1A2E]">À réceptionner</h1>
          <p className="mt-1 text-sm text-gray-500">
            Validez la réception produit par produit. En cas d&apos;anomalie, un avoir PDF est généré automatiquement.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : commandes.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center">
            <span className="text-5xl">📦</span>
            <p className="mt-3 text-gray-500">Aucune livraison en attente de réception.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {commandes.map((c) => {
              const f = fournMap[c.fournisseur_id];
              const display = f?.nom_commercial || f?.nom_etablissement || "Fournisseur";
              const isOpen = openId === c.id;

              return (
                <div key={c.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Livrée · à réceptionner</p>
                      <p className="mt-1 text-lg font-semibold text-[#1A1A2E]">{display}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(c.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{c.lignes_commande.length} article{c.lignes_commande.length > 1 ? "s" : ""}
                        {" · "}{fmt(c.montant_total)}
                      </p>
                    </div>
                    <button
                      onClick={() => (isOpen ? setOpenId(null) : openCommande(c))}
                      className="min-h-[44px] rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-600"
                    >
                      {isOpen ? "Fermer" : "Réceptionner"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-200 bg-gray-50 p-5">
                      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                        <table className="w-full min-w-[560px] text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                              <th className="px-3 py-2 text-left">Produit</th>
                              <th className="px-3 py-2 text-right">Cmdé</th>
                              <th className="px-3 py-2 text-center">Reçu</th>
                              <th className="px-3 py-2 text-center">Qualité</th>
                              <th className="px-3 py-2 text-left">Motif</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {c.lignes_commande.map((l) => {
                              const ls = lines[l.id];
                              if (!ls) return null;
                              const nonConf = ls.editQualite === "non_conforme";
                              return (
                                <tr key={l.id}>
                                  <td className="px-3 py-2.5">
                                    <p className="font-medium text-[#1A1A2E]">{l.nom_snapshot}</p>
                                    <p className="text-[11px] text-gray-500">{fmt(l.prix_snapshot)}/{l.unite}</p>
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-gray-600">{l.quantite} {l.unite}</td>
                                  <td className="px-3 py-2.5">
                                    <input
                                      type="number" min="0" step="0.01"
                                      value={ls.editQte}
                                      onChange={(e) => updateLine(l.id, { editQte: e.target.value })}
                                      className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-indigo-500"
                                    />
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex justify-center gap-1">
                                      <button
                                        onClick={() => updateLine(l.id, { editQualite: "conforme" })}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                                          !nonConf
                                            ? "bg-emerald-500 text-white"
                                            : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                                        }`}
                                      >✓</button>
                                      <button
                                        onClick={() => updateLine(l.id, { editQualite: "non_conforme" })}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                                          nonConf
                                            ? "bg-red-500 text-white"
                                            : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                                        }`}
                                      >✕</button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {nonConf ? (
                                      <select
                                        value={ls.editMotif}
                                        onChange={(e) => updateLine(l.id, { editMotif: e.target.value })}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
                                      >
                                        <option value="">— Choisir —</option>
                                        {MOTIFS.map(m => <option key={m} value={m}>{m}</option>)}
                                      </select>
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

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                          Les anomalies génèreront automatiquement un PDF d&apos;avoir.
                        </p>
                        <button
                          onClick={() => handleValidate(c)}
                          disabled={submitting}
                          className="min-h-[44px] rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-600 disabled:opacity-50"
                        >
                          {submitting ? "Validation…" : "Valider la réception"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-2xl border px-4 py-3 shadow-2xl ${
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}
    </DashboardLayout>
  );
}
