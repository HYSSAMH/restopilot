"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import type { DbCommande, StatutCommande } from "@/lib/supabase/types";

// ── Statut config ──────────────────────────────────────────────────────────
const STATUTS: { value: StatutCommande; label: string; next: StatutCommande | null; dot: string; badge: string; btn?: string }[] = [
  { value: "recue",                        label: "Reçue",                    next: "en_preparation", dot: "bg-amber-400",   badge: "border-amber-200 bg-amber-50 text-amber-700",   btn: "Démarrer la préparation →" },
  { value: "en_preparation",               label: "En préparation",           next: "en_livraison",   dot: "bg-blue-400",    badge: "border-blue-200 bg-blue-50 text-blue-700",      btn: "Marquer en livraison →" },
  { value: "en_livraison",                 label: "En livraison",             next: "livree",         dot: "bg-violet-400",  badge: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]", btn: "Confirmer la livraison →" },
  { value: "livree",                       label: "Livrée · attente récep.",  next: null,             dot: "bg-sky-400",     badge: "border-sky-200 bg-sky-50 text-sky-700" },
  { value: "receptionnee",                 label: "Réceptionnée ✓",           next: null,             dot: "bg-emerald-400", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "receptionnee_avec_anomalies",  label: "Récep. avec anomalies",    next: null,             dot: "bg-rose-400",    badge: "border-rose-200 bg-rose-50 text-rose-700" },
  { value: "annulee",                      label: "Annulée",                  next: null,             dot: "bg-red-400",     badge: "border-red-200 bg-red-50 text-red-700" },
];

function getStatut(v: StatutCommande) {
  return STATUTS.find((s) => s.value === v) ?? STATUTS[0];
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Badge statut ───────────────────────────────────────────────────────────
function StatutBadge({ statut }: { statut: StatutCommande }) {
  const cfg = getStatut(statut);
  const isActive = statut !== "livree" && statut !== "annulee";
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${isActive ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ── Carte commande ─────────────────────────────────────────────────────────
function CommandeCard({
  commande,
  displayName,
  onStatutChange,
  updating,
}: {
  commande: DbCommande;
  displayName: string;
  onStatutChange: (id: string, next: StatutCommande) => void;
  updating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cfg = getStatut(commande.statut);
  const f = commande.fournisseurs;

  return (
    <div className={`rounded-[10px] border transition-all duration-200 ${
      commande.statut === "recue" ? "border-amber-500/30 bg-amber-500/5" : "border-[var(--border)] bg-white"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        {/* Avatar fournisseur */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${f.avatar} text-sm font-bold text-[var(--text)] shadow-md`}>
          {f.initiale}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--text)]">{displayName}</span>
            {commande.statut === "recue" && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">NOUVEAU</span>
            )}
            {commande.statut === "receptionnee" && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                RÉCEPTIONNÉE ✓
              </span>
            )}
            {commande.statut === "receptionnee_avec_anomalies" && (commande as DbCommande & { avoir_montant?: number }).avoir_montant != null && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                AVOIR {Number((commande as DbCommande & { avoir_montant?: number }).avoir_montant).toFixed(2)} €
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>🚚 {f.nom}</span>
            <span>·</span>
            <span>{timeAgo(commande.created_at)}</span>
            <span>·</span>
            <span>{commande.lignes_commande.length} article{commande.lignes_commande.length > 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Right: montant + statut */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-lg font-bold text-[var(--text)]">{fmt(commande.montant_total)}</span>
          <StatutBadge statut={commande.statut} />
        </div>
      </div>

      {/* Toggle lignes */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-t border-[var(--border)] px-5 py-2.5 text-xs text-gray-500 transition-colors hover:bg-[var(--bg-subtle)] hover:text-gray-600"
      >
        <span>{open ? "Masquer le détail" : "Voir le détail"}</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* Lignes de commande */}
      {open && (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-gray-400">
                <th className="pb-2 text-left font-medium">Produit</th>
                <th className="pb-2 text-right font-medium">Qté</th>
                <th className="pb-2 text-right font-medium">P.U.</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commande.lignes_commande.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 text-gray-700">{l.nom_snapshot}</td>
                  <td className="py-2 text-right text-gray-500">{l.quantite} {l.unite}</td>
                  <td className="py-2 text-right text-gray-500">{fmt(l.prix_snapshot)}</td>
                  <td className="py-2 text-right font-medium text-[var(--text)]">{fmt(l.prix_snapshot * l.quantite)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action bouton */}
      {cfg.next && (
        <div className="border-t border-[var(--border)] px-5 py-3">
          <button
            onClick={() => onStatutChange(commande.id, cfg.next!)}
            disabled={updating}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--text)] shadow-md shadow-violet-500/20 transition-all hover:from-indigo-600 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updating ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : <span>✓</span>}
            {cfg.btn}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────
export default function FournisseurCommandesPage() {
  const [commandes, setCommandes] = useState<DbCommande[]>([]);
  const [restoNames, setRestoNames] = useState<Record<string, string>>({}); // user_id → nom_commercial courant
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<StatutCommande | "tous">("tous");
  const [newCount, setNewCount] = useState(0);

  const supabase = createClient();

  const fetchCommandes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("commandes")
      .select(`
        id, restaurateur_id, restaurateur_nom, fournisseur_id, statut, montant_total, avoir_montant, receptionnee_at, created_at, updated_at,
        fournisseurs ( nom, initiale, avatar ),
        lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite )
      `)
      .eq("fournisseur_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      const typed = data as unknown as (DbCommande & { restaurateur_id: string | null })[];
      setCommandes(typed as DbCommande[]);

      // Récupère les noms COURANTS des restaurateurs (source de vérité : profiles)
      const ids = Array.from(new Set(typed.map(c => c.restaurateur_id).filter((x): x is string => !!x)));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nom_commercial, nom_etablissement")
          .in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach(p => {
          map[p.id] =
            (p.nom_commercial?.trim()) ||
            (p.nom_etablissement?.trim()) ||
            "";
        });
        setRestoNames(map);
      }
    }
    setLoading(false);
  }, [supabase]);

  // Helper : affiche le nom COURANT du restaurateur (pas le snapshot)
  const getRestoName = useCallback(
    (c: DbCommande & { restaurateur_id?: string | null }) => {
      const live = c.restaurateur_id ? restoNames[c.restaurateur_id] : "";
      return live || c.restaurateur_nom || "Restaurateur";
    },
    [restoNames],
  );

  // Chargement initial
  useEffect(() => { fetchCommandes(); }, [fetchCommandes]);

  // ── Realtime subscription ───────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("commandes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commandes" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Re-fetch pour avoir les jointures (fournisseurs + lignes)
            fetchCommandes();
            setNewCount((n) => n + 1);
          } else if (payload.eventType === "UPDATE") {
            setCommandes((prev) =>
              prev.map((c) =>
                c.id === payload.new.id
                  ? { ...c, statut: payload.new.statut as StatutCommande, updated_at: payload.new.updated_at }
                  : c
              )
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCommandes]);

  // ── Changer le statut ──────────────────────────────────────────────────
  const handleStatutChange = useCallback(async (id: string, next: StatutCommande) => {
    setUpdating(id);
    await supabase.from("commandes").update({ statut: next }).eq("id", id);
    setUpdating(null);
  }, []);

  // ── Filtrage & stats ───────────────────────────────────────────────────
  const filtrees = filtre === "tous" ? commandes : commandes.filter((c) => c.statut === filtre);
  const stats = {
    recue:          commandes.filter((c) => c.statut === "recue").length,
    en_preparation: commandes.filter((c) => c.statut === "en_preparation").length,
    en_livraison:   commandes.filter((c) => c.statut === "en_livraison").length,
    livree:         commandes.filter((c) => c.statut === "livree").length,
  };
  const caJour = commandes
    .filter((c) => {
      const d = new Date(c.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((s, c) => s + c.montant_total, 0);

  return (
    <DashboardLayout role="fournisseur">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-700/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-purple-500/8 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/dashboard/fournisseur" className="hover:text-gray-600 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-gray-600">Commandes reçues</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">Commandes reçues</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Temps réel activé
                </span>
                {newCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    +{newCount} depuis l'ouverture
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-[8px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-2 text-right">
              <p className="text-xs text-[var(--accent)]/70">CA aujourd'hui</p>
              <p className="text-lg font-bold text-[var(--accent)]">{fmt(caJour)}</p>
            </div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {[
            { label: "À préparer",    value: stats.recue,          color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
            { label: "En prépa.",     value: stats.en_preparation, color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
            { label: "En livraison",  value: stats.en_livraison,   color: "text-[var(--accent)]",  bg: "bg-[var(--accent-soft)]",  border: "border-violet-500/20" },
            { label: "Livrées",       value: stats.livree,         color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
          ].map((s) => (
            <div key={s.label} className={`rounded-[8px] border ${s.border} ${s.bg} px-4 py-3`}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="mb-5 flex flex-wrap gap-2 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          {([
            { id: "tous",          label: "Toutes",         count: commandes.length },
            { id: "recue",         label: "Reçues",         count: stats.recue },
            { id: "en_preparation",label: "En prépa.",      count: stats.en_preparation },
            { id: "en_livraison",  label: "En livraison",   count: stats.en_livraison },
            { id: "livree",        label: "Livrées",        count: stats.livree },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltre(f.id)}
              className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm font-medium transition-all ${
                filtre === f.id
                  ? "bg-[var(--accent)] text-[var(--text)] shadow-lg shadow-indigo-500/20"
                  : "border border-[var(--border)] bg-white text-gray-500 hover:bg-[var(--bg-subtle)] hover:text-gray-700"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${filtre === f.id ? "bg-white/20" : "bg-[var(--bg-subtle)] text-gray-400"}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
            ))}
          </div>
        ) : filtrees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-[var(--border)] bg-white py-20 text-center">
            <span className="text-4xl">📭</span>
            <p className="text-gray-500">
              {filtre === "tous" ? "Aucune commande reçue pour l'instant." : `Aucune commande avec le statut « ${getStatut(filtre as StatutCommande)?.label} ».`}
            </p>
            <p className="text-sm text-gray-400">Les nouvelles commandes apparaissent ici en temps réel.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtrees.map((cmd) => (
              <div key={cmd.id} className="animate-fade-in-up">
                <CommandeCard
                  commande={cmd}
                  displayName={getRestoName(cmd as DbCommande & { restaurateur_id?: string | null })}
                  onStatutChange={handleStatutChange}
                  updating={updating === cmd.id}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
