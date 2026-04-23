"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import type { StatutCommande } from "@/lib/supabase/types";
import { regenerateAvoirPDF } from "@/lib/avoir-from-db";
import { Pagination, paginate, PAGE_SIZE_DEFAULT } from "@/components/ui/Pagination";

// ── Types locaux tolérants (tous les champs fournisseur/avoir sont optionnels) ──
interface Ligne {
  id: string;
  nom_snapshot: string;
  prix_snapshot: number;
  unite: string;
  quantite: number;
}
interface Commande {
  id: string;
  restaurateur_nom: string | null;
  fournisseur_id: string | null;
  fournisseur_externe_id: string | null;
  statut: StatutCommande;
  montant_total: number;
  avoir_montant: number | null;
  avoir_statut: "en_attente" | "accepte" | "conteste" | "annule" | null;
  avoir_motif_contestation: string | null;
  source: string | null;
  numero_facture_externe: string | null;
  created_at: string;
  updated_at: string | null;
  fournisseurs: { nom: string; initiale: string; avatar: string } | null;
  lignes_commande: Ligne[];
}

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
  const cfg = STATUTS[statut] ?? STATUTS.recue;
  const isActive = statut !== "livree" && statut !== "annulee" && statut !== "receptionnee";
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${isActive ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function fmt(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

export default function HistoriquePage() {
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [supplierNames, setNames]   = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [filtre, setFiltre]         = useState<StatutCommande | "tous">("tous");
  const [openId, setOpenId]         = useState<string | null>(null);

  // Nouveaux filtres
  const [search, setSearch]         = useState("");
  const [fournFilter, setFournFilter] = useState<string>("");
  const [dateFrom, setDateFrom]     = useState<string>("");
  const [dateTo, setDateTo]         = useState<string>("");
  const [montantMin, setMontantMin] = useState<string>("");
  const [montantMax, setMontantMax] = useState<string>("");
  const [page, setPage]             = useState(1);

  const fetchCommandes = useCallback(async () => {
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: err } = await supabase
        .from("commandes")
        .select(`
          id, restaurateur_nom, fournisseur_id, fournisseur_externe_id,
          statut, montant_total, created_at, updated_at,
          avoir_montant, avoir_statut, avoir_motif_contestation,
          source, numero_facture_externe,
          fournisseurs ( nom, initiale, avatar ),
          lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite )
        `)
        .eq("restaurateur_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (err) throw new Error(err.message);

      const typed = (data ?? []) as unknown as Commande[];
      setCommandes(typed);

      // Noms des fournisseurs : profils internes + fournisseurs_externes
      const internalIds = Array.from(new Set(typed.map(c => c.fournisseur_id).filter((x): x is string => !!x)));
      const externalIds = Array.from(new Set(typed.map(c => c.fournisseur_externe_id).filter((x): x is string => !!x)));
      const map: Record<string, string> = {};

      if (internalIds.length > 0) {
        try {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, nom_commercial, nom_etablissement")
            .in("id", internalIds);
          (profs ?? []).forEach(p => {
            map[p.id] = (p.nom_commercial?.trim()) || (p.nom_etablissement?.trim()) || "";
          });
        } catch (e) { console.warn("[historique] profiles fetch non critique :", e); }
      }
      if (externalIds.length > 0) {
        try {
          const { data: ext } = await supabase
            .from("fournisseurs_externes").select("id, nom").in("id", externalIds);
          (ext ?? []).forEach(e => { map[e.id] = `${e.nom} (externe)`; });
        } catch (e) { console.warn("[historique] fournisseurs_externes fetch non critique :", e); }
      }
      setNames(map);
    } catch (e) {
      console.error("[historique] erreur chargement :", e);
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
    setLoading(false);
  }, []);

  const getFournName = useCallback(
    (c: Commande) => {
      const id = c.fournisseur_id ?? c.fournisseur_externe_id;
      if (id && supplierNames[id]) return supplierNames[id];
      return c.fournisseurs?.nom || "Fournisseur";
    },
    [supplierNames],
  );
  const getFournInitiale = (c: Commande) => {
    if (c.fournisseurs?.initiale) return c.fournisseurs.initiale;
    return (getFournName(c) || "?").charAt(0).toUpperCase();
  };
  const getFournAvatar = (c: Commande) =>
    c.fournisseurs?.avatar || "from-indigo-500 to-violet-500";

  useEffect(() => { fetchCommandes(); }, [fetchCommandes]);

  // Realtime — silencieux en cas d'erreur, la page reste fonctionnelle
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      supabase = createClient();
      channel = supabase
        .channel("commandes-resto-realtime")
        .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "commandes" },
          (payload) => {
            setCommandes((prev) =>
              prev.map((c) =>
                c.id === payload.new.id
                  ? { ...c,
                      statut: payload.new.statut as StatutCommande,
                      avoir_statut: payload.new.avoir_statut ?? null,
                      avoir_motif_contestation: payload.new.avoir_motif_contestation ?? null,
                      updated_at: payload.new.updated_at,
                    }
                  : c,
              ),
            );
          },
        )
        .subscribe();
    } catch (e) {
      console.warn("[historique] realtime désactivé :", e);
    }
    return () => {
      if (channel) try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  const filtrees = useMemo(() => {
    let arr = commandes;
    if (filtre !== "tous")   arr = arr.filter(c => c.statut === filtre);
    if (fournFilter)         arr = arr.filter(c => (c.fournisseur_id ?? c.fournisseur_externe_id) === fournFilter);
    if (dateFrom)            arr = arr.filter(c => c.created_at.slice(0, 10) >= dateFrom);
    if (dateTo)              arr = arr.filter(c => c.created_at.slice(0, 10) <= dateTo);
    const mMin = parseFloat(montantMin);
    if (!isNaN(mMin) && mMin > 0) arr = arr.filter(c => Number(c.montant_total) >= mMin);
    const mMax = parseFloat(montantMax);
    if (!isNaN(mMax) && mMax > 0) arr = arr.filter(c => Number(c.montant_total) <= mMax);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(c => {
        const nom = getFournName(c).toLowerCase();
        const num = (c.numero_facture_externe ?? "").toLowerCase();
        const idShort = c.id.toLowerCase();
        return nom.includes(s) || num.includes(s) || idShort.includes(s)
               || c.lignes_commande?.some(l => (l.nom_snapshot ?? "").toLowerCase().includes(s));
      });
    }
    return arr;
  }, [commandes, filtre, fournFilter, dateFrom, dateTo, montantMin, montantMax, search, getFournName]);

  useEffect(() => { setPage(1); }, [filtre, fournFilter, dateFrom, dateTo, montantMin, montantMax, search]);

  const fournUniques = useMemo(() => {
    const set = new Map<string, string>();
    commandes.forEach(c => {
      const id = c.fournisseur_id ?? c.fournisseur_externe_id;
      if (id && !set.has(id)) set.set(id, getFournName(c));
    });
    return Array.from(set.entries()).map(([id, nom]) => ({ id, nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [commandes, getFournName]);

  const pageRows = paginate(filtrees, page, PAGE_SIZE_DEFAULT);

  const totalDepense = commandes
    .filter((c) => c.statut !== "annulee")
    .reduce((s, c) => s + Number(c.montant_total ?? 0), 0);
  const nbEnCours = commandes.filter((c) =>
    c.statut === "recue" || c.statut === "en_preparation" || c.statut === "en_livraison",
  ).length;

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Mes commandes</span>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">Mes commandes</h1>
            <p className="page-sub">Suivez le statut de vos commandes en temps réel.</p>
          </div>
          <Link
            href="/dashboard/restaurateur/commandes"
            className="flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-3.5 py-[7px] text-[13px] font-[550] text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            <span>+</span> Nouvelle commande
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Total commandes" value={String(commandes.length)} />
          <Kpi label="En cours"        value={String(nbEnCours)} accent="amber" />
          <Kpi label="Total dépensé"   value={fmt(totalDepense)} wide />
        </div>

        {/* Recherche globale + filtres avancés */}
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Rechercher : fournisseur, n° facture, id de commande, produit…"
            className="mb-3 w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={fournFilter}
              onChange={(e) => setFournFilter(e.target.value)}
              className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Tous fournisseurs</option>
              {fournUniques.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-gray-500">Du</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined}
                     className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-gray-500">Au</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined}
                     className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-gray-500">Min €</span>
              <input type="number" min="0" step="0.01" value={montantMin} onChange={(e) => setMontantMin(e.target.value)} placeholder="0"
                     className="min-h-[40px] w-24 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-gray-500">Max €</span>
              <input type="number" min="0" step="0.01" value={montantMax} onChange={(e) => setMontantMax(e.target.value)} placeholder="∞"
                     className="min-h-[40px] w-24 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
            </label>
            {(search || fournFilter || dateFrom || dateTo || montantMin || montantMax || filtre !== "tous") && (
              <button
                onClick={() => { setSearch(""); setFournFilter(""); setDateFrom(""); setDateTo(""); setMontantMin(""); setMontantMax(""); setFiltre("tous"); }}
                className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-600 hover:border-indigo-300"
              >
                Réinitialiser
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
            {([
              { id: "tous",           label: "Toutes"         },
              { id: "recue",          label: "Reçues"         },
              { id: "en_preparation", label: "En préparation" },
              { id: "en_livraison",   label: "En livraison"   },
              { id: "livree",         label: "Livrées"        },
              { id: "receptionnee",   label: "Réceptionnées"  },
              { id: "annulee",        label: "Annulées"       },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltre(f.id as StatutCommande | "tous")}
                className={`min-h-[34px] rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filtre === f.id
                    ? "bg-indigo-500 text-white shadow"
                    : "border border-gray-200 bg-white text-gray-500 hover:text-[#1A1A2E]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Erreur : {error}. Rechargez la page. Si ça persiste, vérifiez que la migration
            <code className="mx-1 rounded bg-white px-1">migration_factures_import.sql</code>
            a bien été exécutée.
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white" />
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
                className="mt-1 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-500 hover:text-white"
              >
                Passer votre première commande
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {pageRows.map((c) => {
              const open = openId === c.id;
              return (
                <div key={c.id} className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-white">
                  <div className="flex items-start gap-4 p-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br ${getFournAvatar(c)} text-[12px] font-[600] text-white`}>
                      {getFournInitiale(c)}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-[600] text-[var(--text)]">{getFournName(c)}</span>
                        <span className="mono text-[11.5px] text-[var(--text-subtle)]">CMD-{c.id.slice(0, 6).toUpperCase()}</span>
                        {c.source === "import" && (
                          <span className="rp-badge neutral">Importée</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--text-muted)]">
                        <span className="mono">{formatDate(c.created_at)}</span>
                        <span>·</span>
                        <span><span className="mono">{c.lignes_commande?.length ?? 0}</span> article{(c.lignes_commande?.length ?? 0) > 1 ? "s" : ""}</span>
                        {c.numero_facture_externe && (<><span>·</span><span className="mono">N° {c.numero_facture_externe}</span></>)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="mono text-[16px] font-[650] tracking-[-0.01em] text-[var(--text)]">{fmt(c.montant_total)}</span>
                      <StatutBadge statut={c.statut} />
                    </div>
                  </div>

                  {c.avoir_statut && (
                    <AvoirPanel commande={c} onChange={fetchCommandes} />
                  )}

                  <button
                    onClick={() => setOpenId(open ? null : c.id)}
                    className="flex w-full items-center justify-between border-t border-gray-200 px-5 py-2.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
                  >
                    <span>{open ? "Masquer le détail" : "Voir le détail"}</span>
                    <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  {open && (
                    <div className="overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
                      <table className="w-full min-w-[520px] text-[13px]">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="pb-2 text-left label-upper">Produit</th>
                            <th className="pb-2 text-right label-upper">Qté</th>
                            <th className="pb-2 text-right label-upper">P.U.</th>
                            <th className="pb-2 text-right label-upper">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(c.lignes_commande ?? []).map((l) => (
                            <tr key={l.id} className="border-b border-[var(--border)] last:border-b-0">
                              <td className="py-2 text-[var(--text)]">{l.nom_snapshot}</td>
                              <td className="mono py-2 text-right text-[var(--text-muted)]">{l.quantite} {l.unite}</td>
                              <td className="mono py-2 text-right text-[var(--text-muted)]">{fmt(l.prix_snapshot)}</td>
                              <td className="py-2 text-right font-medium text-[#1A1A2E]">{fmt(Number(l.prix_snapshot ?? 0) * Number(l.quantite ?? 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="rounded-2xl border border-gray-200 bg-white">
              <Pagination page={page} total={filtrees.length} onChange={setPage} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, accent, wide }: { label: string; value: string; accent?: "amber"; wide?: boolean }) {
  const ring = accent === "amber" ? "border-[var(--warning-soft)] bg-[var(--warning-soft)]" : "border-[var(--border)] bg-white";
  return (
    <div className={`rounded-[12px] border ${ring} px-4 py-3.5 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <p className="label-upper">{label}</p>
      <p className="mono mt-1.5 text-[22px] font-[650] tracking-[-0.02em] leading-[1.1] text-[var(--text)]">{value}</p>
    </div>
  );
}

// ── Panneau avoir ─────────────────────────────────────────────────────────
function AvoirPanel({ commande, onChange }: { commande: Commande; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const statut = commande.avoir_statut;
  if (!statut) return null;
  const montant = Number(commande.avoir_montant ?? 0);

  async function forceAction(newStatut: "accepte" | "annule") {
    setBusy(true);
    try {
      const supabase = createClient();
      const patch: Record<string, unknown> = { avoir_statut: newStatut };
      if (newStatut === "accepte") patch.avoir_accepte_at = new Date().toISOString();
      if (newStatut === "annule")  patch.avoir_annule_at  = new Date().toISOString();
      await supabase.from("commandes").update(patch).eq("id", commande.id);
      onChange();
    } catch (e) {
      console.error("[avoir] action :", e);
      alert(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }
  async function download() {
    try { await regenerateAvoirPDF(commande.id); }
    catch (e) { console.error(e); alert("Erreur génération PDF"); }
  }

  const cfg =
    statut === "en_attente" ? { bg: "border-amber-200 bg-amber-50",     text: "text-amber-800",   btn: "border-amber-300 text-amber-800 hover:bg-amber-100",     label: `Avoir de ${montant.toFixed(2)} € en attente de réponse du fournisseur.` }
  : statut === "accepte"    ? { bg: "border-emerald-200 bg-emerald-50", text: "text-emerald-800", btn: "border-emerald-300 text-emerald-800 hover:bg-emerald-100", label: `✓ Avoir confirmé par le fournisseur (${montant.toFixed(2)} €)` }
  : statut === "conteste"   ? { bg: "border-rose-200 bg-rose-50",       text: "text-rose-800",    btn: "border-rose-300 text-rose-800 hover:bg-rose-100",           label: "Avoir contesté par le fournisseur" }
  :                           { bg: "border-gray-200 bg-gray-50",       text: "text-gray-600",    btn: "border-gray-300 text-gray-700 hover:bg-gray-100",           label: "Avoir annulé." };

  return (
    <div className={`border-t ${cfg.bg} px-5 py-3`}>
      <p className={`text-sm ${cfg.text} font-medium`}>{cfg.label}</p>
      {statut === "conteste" && commande.avoir_motif_contestation && (
        <p className="mt-1 text-xs text-rose-700">
          <span className="font-semibold">Motif :</span> {commande.avoir_motif_contestation}
        </p>
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {(statut === "en_attente" || statut === "accepte") && (
          <button onClick={download} className={`min-h-[40px] rounded-lg border bg-white px-3 py-1.5 text-xs font-medium ${cfg.btn}`}>
            ↓ Télécharger l&apos;avoir
          </button>
        )}
        {statut === "conteste" && (
          <>
            <button onClick={() => forceAction("annule")} disabled={busy}
                    className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:bg-gray-100 disabled:opacity-50">
              Annuler l&apos;avoir
            </button>
            <button onClick={() => forceAction("accepte")} disabled={busy}
                    className="min-h-[40px] rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50">
              Maintenir l&apos;avoir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
