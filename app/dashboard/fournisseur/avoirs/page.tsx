"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { regenerateAvoirPDF } from "@/lib/avoir-from-db";

type AvoirStatut = "en_attente" | "accepte" | "conteste" | "annule";

interface Ligne {
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
  restaurateur_id: string | null;
  restaurateur_nom: string;
  created_at: string;
  receptionnee_at: string | null;
  avoir_montant: number;
  avoir_statut: AvoirStatut | null;
  avoir_motif_contestation: string | null;
  avoir_accepte_at: string | null;
  avoir_conteste_at: string | null;
  avoir_annule_at: string | null;
  lignes_commande: Ligne[];
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const STATUT_CHIP: Record<AvoirStatut, { label: string; cls: string }> = {
  en_attente: { label: "En attente",      cls: "border-amber-200 bg-amber-50 text-amber-700" },
  accepte:    { label: "Accepté",         cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  conteste:   { label: "Contesté",        cls: "border-rose-200 bg-rose-50 text-rose-700" },
  annule:     { label: "Annulé par resto", cls: "border-[var(--border)] bg-[var(--bg-subtle)] text-gray-600" },
};

function anomaliesOf(c: Commande) {
  return c.lignes_commande.filter(l =>
    l.qualite === "non_conforme" ||
    (l.quantite_recue !== null && Number(l.quantite_recue) < Number(l.quantite)),
  );
}

export default function AvoirsPage() {
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [restoNames, setRestoNames] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<"tous" | AvoirStatut>("en_attente");
  const [openId, setOpenId]         = useState<string | null>(null);
  const [contestId, setContestId]   = useState<string | null>(null);
  const [contestMotif, setContestMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchAvoirs = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("commandes")
      .select(`
        id, restaurateur_id, restaurateur_nom, created_at, receptionnee_at,
        avoir_montant, avoir_statut, avoir_motif_contestation,
        avoir_accepte_at, avoir_conteste_at, avoir_annule_at,
        lignes_commande ( id, nom_snapshot, unite, prix_snapshot, quantite, quantite_recue, qualite, motif_anomalie )
      `)
      .eq("fournisseur_id", user.id)
      .not("avoir_statut", "is", null)
      .order("receptionnee_at", { ascending: false });

    const typed = (data ?? []) as unknown as Commande[];
    setCommandes(typed);

    const ids = Array.from(new Set(typed.map(c => c.restaurateur_id).filter((x): x is string => !!x)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nom_commercial, nom_etablissement").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach(p => { map[p.id] = p.nom_commercial || p.nom_etablissement || "—"; });
      setRestoNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAvoirs(); }, [fetchAvoirs]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Realtime : suit les updates d'avoir
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("avoirs-fourn-realtime")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        () => fetchAvoirs(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAvoirs]);

  const filtered = useMemo(() => {
    if (filter === "tous") return commandes;
    return commandes.filter(c => c.avoir_statut === filter);
  }, [commandes, filter]);

  const counts = useMemo(() => ({
    en_attente: commandes.filter(c => c.avoir_statut === "en_attente").length,
    accepte:    commandes.filter(c => c.avoir_statut === "accepte").length,
    conteste:   commandes.filter(c => c.avoir_statut === "conteste").length,
    annule:     commandes.filter(c => c.avoir_statut === "annule").length,
  }), [commandes]);

  const totalEnAttente = commandes
    .filter(c => c.avoir_statut === "en_attente")
    .reduce((s, c) => s + Number(c.avoir_montant), 0);

  async function accept(c: Commande) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("commandes").update({
      avoir_statut:    "accepte",
      avoir_accepte_at: new Date().toISOString(),
    }).eq("id", c.id);
    setSubmitting(false);
    if (error) setToast({ type: "error", msg: error.message });
    else {
      setToast({ type: "success", msg: `Avoir de ${fmt(c.avoir_montant)} accepté.` });
      fetchAvoirs();
    }
  }

  async function submitContestation() {
    if (!contestId) return;
    if (contestMotif.trim().length < 5) {
      setToast({ type: "error", msg: "Motif de contestation trop court (5 caractères min)." });
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("commandes").update({
      avoir_statut:              "conteste",
      avoir_conteste_at:         new Date().toISOString(),
      avoir_motif_contestation:  contestMotif.trim(),
    }).eq("id", contestId);
    setSubmitting(false);
    if (error) setToast({ type: "error", msg: error.message });
    else {
      setToast({ type: "success", msg: "Contestation envoyée au restaurateur." });
      setContestId(null); setContestMotif("");
      fetchAvoirs();
    }
  }

  async function downloadPdf(id: string) {
    try { await regenerateAvoirPDF(id); }
    catch (e) {
      console.error(e);
      setToast({ type: "error", msg: "Impossible de générer le PDF." });
    }
  }

  return (
    <DashboardLayout role="fournisseur">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/fournisseur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Avoirs</span>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Avoirs reçus</h1>
            <p className="mt-1 text-sm text-gray-500">
              {counts.en_attente > 0
                ? `${counts.en_attente} avoir${counts.en_attente > 1 ? "s" : ""} en attente de votre réponse.`
                : "Aucun avoir en attente."}
            </p>
          </div>
          {totalEnAttente > 0 && (
            <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">En attente</p>
              <p className="text-lg font-bold text-amber-800">{fmt(totalEnAttente)}</p>
            </div>
          )}
        </div>

        {/* Filtres statut */}
        <div className="mb-5 flex flex-wrap gap-2">
          {([
            { id: "en_attente", label: `En attente (${counts.en_attente})` },
            { id: "accepte",    label: `Acceptés (${counts.accepte})`       },
            { id: "conteste",   label: `Contestés (${counts.conteste})`     },
            { id: "annule",     label: `Annulés (${counts.annule})`         },
            { id: "tous",       label: `Tous (${commandes.length})`          },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-[40px] rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-white text-gray-500 hover:text-[var(--text)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--border)] bg-white py-20 text-center text-gray-500">
            Aucun avoir dans cette catégorie.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((c) => {
              const anom = anomaliesOf(c);
              const statut = c.avoir_statut!;
              const chip = STATUT_CHIP[statut];
              const isOpen = openId === c.id;
              const resto = c.restaurateur_id ? (restoNames[c.restaurateur_id] ?? c.restaurateur_nom) : c.restaurateur_nom;

              return (
                <div key={c.id} className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-[var(--text)]">{resto}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                          {chip.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Commande {c.id.slice(0, 8).toUpperCase()} · Réceptionnée le{" "}
                        {c.receptionnee_at ? new Date(c.receptionnee_at).toLocaleDateString("fr-FR") : "—"}
                        {" · "}{anom.length} anomalie{anom.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Montant avoir</p>
                      <p className="text-xl font-bold text-rose-600">{fmt(c.avoir_montant)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setOpenId(isOpen ? null : c.id)}
                    className="flex w-full items-center justify-between border-t border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-2.5 text-xs text-gray-500 hover:bg-[var(--bg-subtle)]"
                  >
                    <span>{isOpen ? "Masquer" : "Voir"} le détail des anomalies</span>
                    <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--border)] p-5">
                      <div className="overflow-x-auto rounded-[8px] border border-[var(--border)]">
                        <table className="w-full min-w-[520px] text-sm">
                          <thead>
                            <tr className="bg-[var(--bg-subtle)] text-xs font-medium uppercase tracking-wide text-gray-500">
                              <th className="px-3 py-2 text-left">Produit</th>
                              <th className="px-3 py-2 text-right">Cmdé</th>
                              <th className="px-3 py-2 text-right">Reçu</th>
                              <th className="px-3 py-2 text-left">Motif</th>
                              <th className="px-3 py-2 text-right">Avoir</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {anom.map((l) => {
                              const qteRecue = l.qualite === "non_conforme" ? 0 : Number(l.quantite_recue ?? 0);
                              const ecart = Math.max(0, Number(l.quantite) - qteRecue);
                              const montant = l.qualite === "non_conforme"
                                ? Number(l.quantite) * Number(l.prix_snapshot)
                                : ecart * Number(l.prix_snapshot);
                              return (
                                <tr key={l.id}>
                                  <td className="px-3 py-2 text-[var(--text)]">{l.nom_snapshot}</td>
                                  <td className="px-3 py-2 text-right text-gray-500">{l.quantite} {l.unite}</td>
                                  <td className="px-3 py-2 text-right text-gray-500">{qteRecue} {l.unite}</td>
                                  <td className="px-3 py-2 text-rose-600">
                                    {l.qualite === "non_conforme" ? (l.motif_anomalie ?? "Non conforme") : "Manquant"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-rose-600">{fmt(montant)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Contestation existante */}
                      {c.avoir_motif_contestation && (
                        <div className="mt-4 rounded-[8px] border border-rose-200 bg-rose-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                            Motif de contestation (vous)
                          </p>
                          <p className="mt-1 text-sm text-rose-800">{c.avoir_motif_contestation}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => downloadPdf(c.id)}
                          className="min-h-[44px] rounded-[8px] border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:border-indigo-300 hover:text-[var(--accent)]"
                        >
                          ↓ Télécharger le PDF
                        </button>
                        {statut === "en_attente" && (
                          <>
                            <button
                              onClick={() => { setContestId(c.id); setContestMotif(""); }}
                              disabled={submitting}
                              className="min-h-[44px] rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Contester
                            </button>
                            <button
                              onClick={() => accept(c)}
                              disabled={submitting}
                              className="min-h-[44px] rounded-[8px] bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-600 disabled:opacity-50"
                            >
                              Accepter l&apos;avoir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modale contestation */}
      {contestId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[var(--border)] bg-white shadow-2xl">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-lg font-bold text-[var(--text)]">Contester l&apos;avoir</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Expliquez pourquoi vous contestez. Le restaurateur pourra soit maintenir l&apos;avoir soit l&apos;annuler.
              </p>
            </div>
            <div className="p-5">
              <textarea
                value={contestMotif}
                onChange={(e) => setContestMotif(e.target.value)}
                placeholder="ex : Les produits ont été livrés conformes, signés par le client sur le bon de livraison n°…"
                rows={5}
                className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:shadow-[0_0_0_3px_var(--accent-soft)]"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-3">
              <button
                onClick={() => { setContestId(null); setContestMotif(""); }}
                className="min-h-[44px] rounded-[8px] border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)]"
              >
                Annuler
              </button>
              <button
                onClick={submitContestation}
                disabled={submitting || contestMotif.trim().length < 5}
                className="min-h-[44px] rounded-[8px] bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600 disabled:opacity-50"
              >
                Envoyer la contestation
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-[10px] border px-4 py-3 shadow-2xl ${
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
