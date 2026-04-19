"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import type { DbCommande, StatutCommande } from "@/lib/supabase/types";
import { regenerateAvoirPDF } from "@/lib/avoir-from-db";

const STATUTS: Record<StatutCommande, { label: string; dot: string; badge: string }> = {
  recue:                       { label: "Reçue",            dot: "bg-amber-400",   badge: "border-amber-200 bg-amber-50 text-amber-700"    },
  en_preparation:              { label: "En préparation",   dot: "bg-blue-400",    badge: "border-blue-200 bg-blue-50 text-blue-700"       },
  en_livraison:                { label: "En livraison",     dot: "bg-violet-400",  badge: "border-indigo-200 bg-indigo-50 text-indigo-600" },
  livree:                      { label: "Livrée",           dot: "bg-sky-400",     badge: "border-sky-200 bg-sky-50 text-sky-700"          },
  receptionnee:                { label: "Réceptionnée",     dot: "bg-emerald-400", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  receptionnee_avec_anomalies: { label: "Avec anomalies",   dot: "bg-rose-400",    badge: "border-rose-200 bg-rose-50 text-rose-700"        },
  annulee:                     { label: "Annulée",          dot: "bg-red-400",     badge: "border-red-200 bg-red-50 text-red-700"          },
};

function StatutBadge({ statut }: { statut: StatutCommande }) {
  const cfg = STATUTS[statut];
  const isActive = statut !== "livree" && statut !== "annulee";
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${isActive ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function HistoriquePage() {
  const [commandes, setCommandes]   = useState<DbCommande[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({}); // user_id → nom courant
  const [loading, setLoading]       = useState(true);
  const [filtre, setFiltre]         = useState<StatutCommande | "tous">("tous");
  const [openId, setOpenId]         = useState<string | null>(null);

  const supabase = createClient();

  const fetchCommandes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("commandes")
      .select(`
        id, restaurateur_nom, fournisseur_id, statut, montant_total, created_at, updated_at,
        avoir_montant, avoir_statut, avoir_motif_contestation,
        fournisseurs ( nom, initiale, avatar ),
        lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite )
      `)
      .eq("restaurateur_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (data) {
      const typed = data as unknown as DbCommande[];
      setCommandes(typed);

      // Nom COURANT du fournisseur (source de vérité : profiles)
      const ids = Array.from(new Set(typed.map(c => c.fournisseur_id).filter(Boolean)));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nom_commercial, nom_etablissement")
          .in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach(p => {
          map[p.id] = (p.nom_commercial?.trim()) || (p.nom_etablissement?.trim()) || "";
        });
        setFournNames(map);
      }
    }
    setLoading(false);
  }, [supabase]);

  const getFournName = useCallback(
    (c: DbCommande) => fournNames[c.fournisseur_id] || c.fournisseurs.nom || "Fournisseur",
    [fournNames],
  );

  useEffect(() => { fetchCommandes(); }, [fetchCommandes]);

  // Realtime : mise à jour automatique quand le statut change côté fournisseur
  useEffect(() => {
    const channel = supabase
      .channel("commandes-resto-realtime")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          setCommandes((prev) =>
            prev.map((c) =>
              c.id === payload.new.id
                ? { ...c, statut: payload.new.statut as StatutCommande, updated_at: payload.new.updated_at }
                : c,
            ),
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const filtrees = filtre === "tous" ? commandes : commandes.filter((c) => c.statut === filtre);
  const totalDepense = commandes
    .filter((c) => c.statut !== "annulee")
    .reduce((s, c) => s + c.montant_total, 0);
  const nbEnCours = commandes.filter((c) =>
    c.statut === "recue" || c.statut === "en_preparation" || c.statut === "en_livraison",
  ).length;

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Mes commandes</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">Mes commandes</h1>
            <p className="mt-1 text-sm text-gray-500">
              Suivez le statut de vos commandes en temps réel.
            </p>
          </div>
          <Link
            href="/dashboard/restaurateur/commandes"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-[#1A1A2E] shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-600"
          >
            <span>+</span> Nouvelle commande
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs text-gray-500">Total commandes</p>
            <p className="mt-1 text-2xl font-bold text-[#1A1A2E]">{commandes.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-5 py-4">
            <p className="text-xs text-gray-500">En cours</p>
            <p className="mt-1 text-2xl font-bold text-[#1A1A2E]">{nbEnCours}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-gray-200 bg-white px-5 py-4 sm:col-span-1">
            <p className="text-xs text-gray-500">Total dépensé</p>
            <p className="mt-1 text-2xl font-bold text-[#1A1A2E]">{fmt(totalDepense)}</p>
          </div>
        </div>

        {/* Filtre */}
        <div className="mb-4 flex flex-wrap gap-2">
          {([
            { id: "tous",           label: "Toutes"         },
            { id: "recue",          label: "Reçues"         },
            { id: "en_preparation", label: "En préparation" },
            { id: "en_livraison",   label: "En livraison"   },
            { id: "livree",         label: "Livrées"        },
            { id: "annulee",        label: "Annulées"       },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltre(f.id as StatutCommande | "tous")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                filtre === f.id
                  ? "bg-indigo-500 text-[#1A1A2E] shadow"
                  : "border border-gray-200 bg-white text-gray-500 hover:text-[#1A1A2E]"
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
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : filtrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-20 text-center">
            <span className="text-5xl">{commandes.length === 0 ? "🛒" : "🔍"}</span>
            <p className="text-gray-500">
              {commandes.length === 0
                ? "Vous n'avez pas encore passé de commande."
                : "Aucune commande pour ce filtre."}
            </p>
            {commandes.length === 0 && (
              <Link
                href="/dashboard/restaurateur/commandes"
                className="mt-1 rounded-xl bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-500 hover:text-[#1A1A2E]"
              >
                Passer votre première commande
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtrees.map((c) => {
              const open = openId === c.id;
              const f = c.fournisseurs;
              return (
                <div key={c.id} className="rounded-2xl border border-gray-200 bg-white">
                  <div className="flex items-start gap-4 p-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${f.avatar} text-sm font-bold text-[#1A1A2E] shadow-md`}>
                      {f.initiale}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-semibold text-[#1A1A2E]">{getFournName(c)}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{formatDate(c.created_at)}</span>
                        <span>·</span>
                        <span>{c.lignes_commande.length} article{c.lignes_commande.length > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-lg font-bold text-[#1A1A2E]">{fmt(c.montant_total)}</span>
                      <StatutBadge statut={c.statut} />
                    </div>
                  </div>

                  {/* ── Panneau avoir (si applicable) ──────────────────────── */}
                  {c.avoir_statut && (
                    <AvoirPanel
                      commande={c}
                      onChange={fetchCommandes}
                    />
                  )}

                  <button
                    onClick={() => setOpenId(open ? null : c.id)}
                    className="flex w-full items-center justify-between border-t border-gray-200 px-5 py-2.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-600"
                  >
                    <span>{open ? "Masquer le détail" : "Voir le détail"}</span>
                    <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  {open && (
                    <div className="border-t border-gray-200 px-5 py-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs text-gray-400">
                            <th className="pb-2 text-left font-medium">Produit</th>
                            <th className="pb-2 text-right font-medium">Qté</th>
                            <th className="pb-2 text-right font-medium">P.U.</th>
                            <th className="pb-2 text-right font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {c.lignes_commande.map((l) => (
                            <tr key={l.id}>
                              <td className="py-2 text-gray-700">{l.nom_snapshot}</td>
                              <td className="py-2 text-right text-gray-500">{l.quantite} {l.unite}</td>
                              <td className="py-2 text-right text-gray-500">{fmt(l.prix_snapshot)}</td>
                              <td className="py-2 text-right font-medium text-[#1A1A2E]">{fmt(l.prix_snapshot * l.quantite)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Panneau avoir (status + actions selon le statut) ──────────────────────
function AvoirPanel({ commande, onChange }: { commande: DbCommande; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const statut = commande.avoir_statut!;
  const montant = Number(commande.avoir_montant ?? 0);

  async function forceAction(newStatut: "accepte" | "annule") {
    setBusy(true);
    const supabase = createClient();
    const patch: Record<string, unknown> = { avoir_statut: newStatut };
    if (newStatut === "accepte") patch.avoir_accepte_at = new Date().toISOString();
    if (newStatut === "annule")  patch.avoir_annule_at  = new Date().toISOString();
    await supabase.from("commandes").update(patch).eq("id", commande.id);
    setBusy(false);
    onChange();
  }

  async function download() {
    try { await regenerateAvoirPDF(commande.id); }
    catch (e) { console.error(e); alert("Erreur génération PDF"); }
  }

  if (statut === "en_attente") {
    return (
      <div className="border-t border-amber-200 bg-amber-50 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Avoir de {montant.toFixed(2)} €</span> en attente de réponse du fournisseur.
          </p>
          <button
            onClick={download}
            className="min-h-[40px] rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            ↓ Télécharger l&apos;avoir
          </button>
        </div>
      </div>
    );
  }

  if (statut === "accepte") {
    return (
      <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-emerald-800">
            ✓ <span className="font-semibold">Avoir confirmé</span> par le fournisseur ({montant.toFixed(2)} €)
          </p>
          <button
            onClick={download}
            className="min-h-[40px] rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
          >
            ↓ Télécharger l&apos;avoir
          </button>
        </div>
      </div>
    );
  }

  if (statut === "conteste") {
    return (
      <div className="border-t border-rose-200 bg-rose-50 px-5 py-3">
        <p className="text-sm font-semibold text-rose-800">
          Avoir contesté par le fournisseur
        </p>
        {commande.avoir_motif_contestation && (
          <p className="mt-1 text-xs text-rose-700">
            <span className="font-semibold">Motif :</span> {commande.avoir_motif_contestation}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => forceAction("annule")}
            disabled={busy}
            className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler l&apos;avoir
          </button>
          <button
            onClick={() => forceAction("accepte")}
            disabled={busy}
            className="min-h-[40px] rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            Maintenir l&apos;avoir
          </button>
        </div>
      </div>
    );
  }

  if (statut === "annule") {
    return (
      <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
        <p className="text-sm text-gray-600">Avoir annulé.</p>
      </div>
    );
  }
  return null;
}
