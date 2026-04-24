"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import type { StatutCommande } from "@/lib/supabase/types";
import { regenerateAvoirPDF } from "@/lib/avoir-from-db";
import { Pagination, paginate, PAGE_SIZE_DEFAULT } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, KpiCard } from "@/components/ui/Card";
import { Input, SearchInput, Select, Field } from "@/components/ui/Input";
import { Table, TableHead, TableRow, TableFooter } from "@/components/ui/Table";
import { Badge, Dot } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Modal";
import { Banner } from "@/components/ui/Feedback";
import { Skeleton } from "@/components/ui/Loading";
import { Icon } from "@/components/ui/Icon";

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

type StatutTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const STATUT_META: Record<StatutCommande, { label: string; tone: StatutTone; active: boolean }> = {
  recue: { label: "Reçue", tone: "warning", active: true },
  en_preparation: { label: "En préparation", tone: "info", active: true },
  en_livraison: { label: "En livraison", tone: "accent", active: true },
  livree: { label: "Livrée", tone: "info", active: false },
  receptionnee: { label: "Réceptionnée", tone: "success", active: false },
  receptionnee_avec_anomalies: { label: "Avec anomalies", tone: "danger", active: false },
  annulee: { label: "Annulée", tone: "neutral", active: false },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
  "linear-gradient(135deg, #EC4899 0%, #F97316 100%)",
  "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
];

function supplierGradient(key: string | null | undefined) {
  if (!key) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function fmt(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return "—"; }
}
function formatDateLong(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

const TABLE_COLUMNS = "36px 92px 120px 1fr 60px 120px 130px 28px";

export default function HistoriquePage() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [supplierNames, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<StatutCommande | "tous">("tous");
  const [openId, setOpenId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [fournFilter, setFournFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [montantMin, setMontantMin] = useState<string>("");
  const [montantMax, setMontantMax] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  useEffect(() => { fetchCommandes(); }, [fetchCommandes]);

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
    if (filtre !== "tous") arr = arr.filter(c => c.statut === filtre);
    if (fournFilter) arr = arr.filter(c => (c.fournisseur_id ?? c.fournisseur_externe_id) === fournFilter);
    if (dateFrom) arr = arr.filter(c => c.created_at.slice(0, 10) >= dateFrom);
    if (dateTo) arr = arr.filter(c => c.created_at.slice(0, 10) <= dateTo);
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
  const nbLitiges = commandes.filter((c) =>
    c.avoir_statut === "en_attente" || c.avoir_statut === "conteste"
    || c.statut === "receptionnee_avec_anomalies",
  ).length;

  const hasFilters = !!(search || fournFilter || dateFrom || dateTo || montantMin || montantMax || filtre !== "tous");
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(c => selected.has(c.id));

  const openCommande = pageRows.find(c => c.id === openId) ?? commandes.find(c => c.id === openId) ?? null;

  const statutFilters: { id: StatutCommande | "tous"; label: string; count?: number }[] = [
    { id: "tous", label: "Toutes", count: commandes.length },
    { id: "recue", label: "Reçues" },
    { id: "en_preparation", label: "En préparation" },
    { id: "en_livraison", label: "En livraison" },
    { id: "livree", label: "Livrées" },
    { id: "receptionnee", label: "Réceptionnées" },
    { id: "annulee", label: "Annulées" },
  ];

  return (
    <DashboardLayout role="restaurateur">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Mes commandes</h1>
          <p className="page-sub">Suivez le statut de vos commandes en temps réel.</p>
        </div>
        <Link href="/dashboard/restaurateur/commandes">
          <Button variant="primary" iconLeft="plus">Nouvelle commande</Button>
        </Link>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        <KpiCard label="Commandes totales" icon="shopping-cart" value={<span className="mono tabular">{commandes.length}</span>} />
        <KpiCard label="En cours" icon="clock" value={<span className="mono tabular">{nbEnCours}</span>} />
        <KpiCard label="Litiges actifs" icon="alert-triangle" value={<span className="mono tabular">{nbLitiges}</span>} delta={nbLitiges > 0 ? { value: "à suivre", trend: "down" } : undefined} />
        <KpiCard label="Total dépensé" icon="euro" value={<span className="mono tabular">{fmt(totalDepense).replace(" €", "")}</span>} unit=" €" />
      </section>

      {/* Filters bar */}
      <section className="mb-3 rounded-[10px] border border-[var(--border)] bg-white">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex-1 min-w-[260px]">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Rechercher : fournisseur, n° facture, produit…"
            />
          </div>
          <Select value={fournFilter} onChange={(e) => setFournFilter(e.target.value)}>
            <option value="">Tous fournisseurs</option>
            {fournUniques.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </Select>
          <Field label="Du">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} className="w-[150px]" />
          </Field>
          <Field label="Au">
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} className="w-[150px]" />
          </Field>
          <Field label="Min €">
            <Input type="number" min="0" step="0.01" value={montantMin} onChange={(e) => setMontantMin(e.target.value)} placeholder="0" className="w-[90px]" />
          </Field>
          <Field label="Max €">
            <Input type="number" min="0" step="0.01" value={montantMax} onChange={(e) => setMontantMax(e.target.value)} placeholder="∞" className="w-[90px]" />
          </Field>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              iconLeft="x"
              onClick={() => {
                setSearch(""); setFournFilter(""); setDateFrom(""); setDateTo("");
                setMontantMin(""); setMontantMax(""); setFiltre("tous");
              }}
            >
              Réinitialiser
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-[2px] border-t border-[var(--border)] p-2">
          {statutFilters.map((f) => {
            const active = filtre === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltre(f.id)}
                className={[
                  "inline-flex items-center gap-[6px] px-3 py-[6px] rounded-[6px] text-[12.5px] font-semibold transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
                ].join(" ")}
              >
                {f.label}
                {typeof f.count === "number" ? (
                  <span className="mono tabular text-[10.5px] px-[5px] py-[1px] rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                    {f.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className="mb-4">
          <Banner tone="danger">
            {error}. Rechargez la page. Si ça persiste, vérifiez que la migration <code className="mono">migration_factures_import.sql</code> a bien été exécutée.
          </Banner>
        </div>
      ) : null}

      {/* Table */}
      {loading ? (
        <Card>
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton width={92} height={14} />
                <Skeleton width={120} height={14} />
                <Skeleton width={220} height={14} />
                <Skeleton width={80} height={14} className="ml-auto" />
                <Skeleton width={120} height={22} rounded={20} />
              </div>
            ))}
          </div>
        </Card>
      ) : filtrees.length === 0 ? (
        <Card>
          <EmptyState
            icon={commandes.length === 0 ? "shopping-cart" : "search"}
            title={commandes.length === 0 ? "Pas encore de commande" : "Aucun résultat"}
            sub={commandes.length === 0 ? "Passez votre première commande pour la retrouver ici." : "Ajustez vos filtres pour élargir la recherche."}
            action={commandes.length === 0 ? (
              <Link href="/dashboard/restaurateur/commandes">
                <Button variant="primary" iconLeft="plus">Passer une commande</Button>
              </Link>
            ) : undefined}
          />
        </Card>
      ) : (
        <Table>
          <TableHead columns={TABLE_COLUMNS}>
            <div>
              <input
                type="checkbox"
                className="w-[15px] h-[15px] accent-[var(--accent)] cursor-pointer"
                aria-label="Tout sélectionner sur cette page"
                checked={allOnPageSelected}
                onChange={(e) => {
                  setSelected(prev => {
                    const next = new Set(prev);
                    if (e.target.checked) pageRows.forEach(c => next.add(c.id));
                    else pageRows.forEach(c => next.delete(c.id));
                    return next;
                  });
                }}
              />
            </div>
            <div>Date</div>
            <div>N°</div>
            <div>Fournisseur</div>
            <div className="text-right">Lignes</div>
            <div className="text-right">TTC</div>
            <div>Statut</div>
            <div></div>
          </TableHead>
          {pageRows.map((c) => {
            const meta = STATUT_META[c.statut] ?? { label: c.statut, tone: "neutral" as StatutTone, active: false };
            const hasLitige = c.avoir_statut === "en_attente" || c.avoir_statut === "conteste" || c.statut === "receptionnee_avec_anomalies";
            const isSelected = selected.has(c.id);
            return (
              <TableRow
                key={c.id}
                columns={TABLE_COLUMNS}
                clickable
                onClick={() => setOpenId(c.id)}
                active={openId === c.id}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="w-[15px] h-[15px] accent-[var(--accent)] cursor-pointer"
                    aria-label={`Sélectionner ${c.id}`}
                    checked={isSelected}
                    onChange={(e) => {
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        return next;
                      });
                    }}
                  />
                </div>
                <div className="mono tabular text-[12.5px] text-[var(--text-muted)]">{formatDateShort(c.created_at)}</div>
                <div className="mono tabular text-[12.5px] font-[600] text-[var(--text)]">
                  {c.source === "import" ? "IMPORT" : `CMD-${c.id.slice(0, 6).toUpperCase()}`}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white text-[11px] font-[650]"
                    style={{ background: supplierGradient(c.fournisseur_id ?? c.fournisseur_externe_id ?? c.id) }}
                  >
                    {getFournInitiale(c)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-[550] text-[var(--text)] truncate">{getFournName(c)}</div>
                    {hasLitige ? (
                      <div className="text-[11px] text-[var(--danger)] font-[550] inline-flex items-center gap-1">
                        <Icon name="alert-triangle" size={10} /> Litige
                      </div>
                    ) : c.numero_facture_externe ? (
                      <div className="mono text-[10.5px] text-[var(--text-subtle)] truncate">{c.numero_facture_externe}</div>
                    ) : null}
                  </div>
                </div>
                <div className="mono tabular text-[12.5px] text-[var(--text-muted)] text-right">{c.lignes_commande?.length ?? 0}</div>
                <div className="mono tabular text-[13px] font-[600] text-[var(--text)] text-right">{fmt(c.montant_total)}</div>
                <div>
                  <Badge tone={meta.tone}>
                    <Dot pulse={meta.active} />
                    {meta.label}
                  </Badge>
                </div>
                <div className="text-[var(--text-subtle)]">
                  <Icon name="chevron-right" size={14} />
                </div>
              </TableRow>
            );
          })}
          <TableFooter
            left={<>{Math.min((page - 1) * PAGE_SIZE_DEFAULT + 1, filtrees.length)}–{Math.min(page * PAGE_SIZE_DEFAULT, filtrees.length)} sur {filtrees.length}</>}
            right={<Pagination page={page} total={filtrees.length} onChange={setPage} />}
          />
        </Table>
      )}

      {/* Drawer détail */}
      <Drawer
        open={!!openCommande}
        onClose={() => setOpenId(null)}
        width={560}
        title={
          openCommande ? (
            <span className="flex items-center gap-2">
              <span className="mono tabular">
                {openCommande.source === "import" ? "Facture importée" : `CMD-${openCommande.id.slice(0, 6).toUpperCase()}`}
              </span>
              <Badge tone={(STATUT_META[openCommande.statut] ?? { tone: "neutral" as StatutTone }).tone}>
                <Dot pulse={STATUT_META[openCommande.statut]?.active} />
                {STATUT_META[openCommande.statut]?.label ?? openCommande.statut}
              </Badge>
            </span>
          ) : undefined
        }
        sub={openCommande ? getFournName(openCommande) : undefined}
        actions={
          openCommande ? (
            <>
              <Button variant="secondary" iconLeft="download">Télécharger le bon de commande</Button>
              {openCommande.numero_facture_externe ? (
                <Button variant="secondary" iconLeft="file-text">Voir la facture</Button>
              ) : null}
              {(openCommande.avoir_statut === "en_attente" || openCommande.avoir_statut === "accepte") ? (
                <Button variant="secondary" iconLeft="alert-circle" onClick={async () => {
                  try { await regenerateAvoirPDF(openCommande.id); }
                  catch (e) { console.error(e); alert("Erreur génération PDF"); }
                }}>
                  Télécharger l&apos;avoir
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {openCommande ? <DrawerContent c={openCommande} refresh={fetchCommandes} /> : null}
      </Drawer>
    </DashboardLayout>
  );
}

// ─── Drawer content ──────────────────────────────────────────────

function DrawerContent({ c, refresh }: { c: Commande; refresh: () => void }) {
  const hasLitige = c.avoir_statut === "en_attente" || c.avoir_statut === "conteste" || c.statut === "receptionnee_avec_anomalies";
  const totalHT = (c.lignes_commande ?? []).reduce((s, l) => s + Number(l.prix_snapshot ?? 0) * Number(l.quantite ?? 0), 0);

  return (
    <div className="space-y-4">
      {hasLitige ? (
        <Banner tone="danger" icon="alert-triangle">
          <div className="font-[550]">Litige en cours</div>
          {c.avoir_motif_contestation ? (
            <div className="text-[11.5px] mt-[2px]">Motif fournisseur : {c.avoir_motif_contestation}</div>
          ) : null}
        </Banner>
      ) : null}

      {/* 4 meta cards */}
      <div className="grid grid-cols-2 gap-[10px]">
        <MetaCard label="Date" value={formatDateLong(c.created_at)} />
        <MetaCard label="Lignes" value={<span className="mono tabular">{c.lignes_commande?.length ?? 0}</span>} />
        <MetaCard label="Montant TTC" value={<span className="mono tabular font-[650]">{fmt(c.montant_total)}</span>} />
        <MetaCard label="Source" value={c.source === "import" ? "Facture importée" : "Commande RestoPilot"} />
      </div>

      {/* Aperçu lignes */}
      <section>
        <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.05em] font-[650] mb-2">Détail des lignes</div>
        <div className="bg-white border border-[var(--border)] rounded-[8px] overflow-hidden">
          {(c.lignes_commande ?? []).slice(0, 6).map((l, i) => (
            <div
              key={l.id}
              className={[
                "flex items-center justify-between gap-3 px-3 py-[10px]",
                i > 0 ? "border-t border-[var(--border)]" : "",
              ].join(" ")}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-[var(--text)] truncate">{l.nom_snapshot}</div>
                <div className="mono tabular text-[11px] text-[var(--text-muted)]">
                  {l.quantite} {l.unite} × {fmt(l.prix_snapshot)}
                </div>
              </div>
              <div className="mono tabular text-[13px] font-[600] text-[var(--text)]">
                {fmt(Number(l.prix_snapshot ?? 0) * Number(l.quantite ?? 0))}
              </div>
            </div>
          ))}
          {(c.lignes_commande?.length ?? 0) > 6 ? (
            <div className="px-3 py-[9px] text-[11.5px] text-[var(--text-muted)] text-center bg-[var(--bg-subtle)] border-t border-[var(--border)]">
              + {c.lignes_commande.length - 6} autre{c.lignes_commande.length - 6 > 1 ? "s" : ""} ligne{c.lignes_commande.length - 6 > 1 ? "s" : ""}
            </div>
          ) : null}
        </div>
      </section>

      {/* Totaux */}
      <section className="bg-white border border-[var(--border)] rounded-[8px] px-[14px] py-[10px]">
        <div className="flex items-center justify-between py-[6px] text-[12.5px] text-[var(--text-muted)]">
          <span>Total HT (calculé)</span>
          <span className="mono tabular text-[var(--text)] font-[550]">{fmt(totalHT)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-[10px] mt-[4px] text-[14px] font-[650] text-[var(--text)]">
          <span>Total TTC</span>
          <span className="mono tabular">{fmt(c.montant_total)}</span>
        </div>
      </section>

      {/* Timeline */}
      <section>
        <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.05em] font-[650] mb-2">Cycle de vie</div>
        <Timeline statut={c.statut} createdAt={c.created_at} updatedAt={c.updated_at} />
      </section>

      {/* Avoir panel */}
      {c.avoir_statut ? <AvoirPanelInline c={c} refresh={refresh} /> : null}
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-[8px] px-3 py-[10px]">
      <div className="text-[10.5px] text-[var(--text-muted)] uppercase tracking-[0.04em] font-[650] mb-[3px]">{label}</div>
      <div className="text-[12.5px] font-[550] text-[var(--text)]">{value}</div>
    </div>
  );
}

// ─── Timeline horizontale ─────────────────────────────────────────

const TIMELINE_STEPS: { id: StatutCommande; label: string }[] = [
  { id: "recue", label: "Reçue" },
  { id: "en_preparation", label: "Préparation" },
  { id: "en_livraison", label: "En livraison" },
  { id: "livree", label: "Livrée" },
  { id: "receptionnee", label: "Réceptionnée" },
];

function Timeline({ statut, createdAt, updatedAt }: { statut: StatutCommande; createdAt: string; updatedAt: string | null }) {
  const currentIdx = TIMELINE_STEPS.findIndex(s => s.id === statut);
  const lastIdx = currentIdx >= 0 ? currentIdx : TIMELINE_STEPS.length - 1;
  return (
    <div className="flex items-start gap-0">
      {TIMELINE_STEPS.map((s, i) => {
        const done = i < lastIdx;
        const current = i === lastIdx;
        const upcoming = i > lastIdx;
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 ? (
                <div
                  className={[
                    "flex-1 h-[2px]",
                    done || current ? "bg-[var(--accent)]" : "bg-[var(--border)]",
                  ].join(" ")}
                />
              ) : <div className="flex-1" />}
              <div
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full text-white text-[11px]",
                  done
                    ? "bg-[var(--success)]"
                    : current
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-subtle)]",
                ].join(" ")}
              >
                {done ? <Icon name="check" size={12} /> : i + 1}
              </div>
              {i < TIMELINE_STEPS.length - 1 ? (
                <div
                  className={[
                    "flex-1 h-[2px]",
                    done ? "bg-[var(--accent)]" : "bg-[var(--border)]",
                  ].join(" ")}
                />
              ) : <div className="flex-1" />}
            </div>
            <div
              className={[
                "text-[10.5px] mt-2 text-center",
                current ? "font-[650] text-[var(--text)]" : upcoming ? "text-[var(--text-subtle)]" : "text-[var(--text-muted)]",
              ].join(" ")}
            >
              {s.label}
            </div>
            {current && updatedAt ? (
              <div className="mono tabular text-[10px] text-[var(--text-muted)]">{formatDateShort(updatedAt || createdAt)}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Avoir inline dans le drawer ──────────────────────────────────

function AvoirPanelInline({ c, refresh }: { c: Commande; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const statut = c.avoir_statut;
  if (!statut) return null;
  const montant = Number(c.avoir_montant ?? 0);

  async function forceAction(newStatut: "accepte" | "annule") {
    setBusy(true);
    try {
      const supabase = createClient();
      const patch: Record<string, unknown> = { avoir_statut: newStatut };
      if (newStatut === "accepte") patch.avoir_accepte_at = new Date().toISOString();
      if (newStatut === "annule") patch.avoir_annule_at = new Date().toISOString();
      await supabase.from("commandes").update(patch).eq("id", c.id);
      refresh();
    } catch (e) {
      console.error("[avoir] action :", e);
      alert(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  const tone =
    statut === "en_attente" ? "warning"
    : statut === "accepte" ? "success"
    : statut === "conteste" ? "danger"
    : "muted";
  const label =
    statut === "en_attente" ? `Avoir de ${fmt(montant)} en attente de réponse du fournisseur.`
    : statut === "accepte" ? `Avoir confirmé par le fournisseur (${fmt(montant)}).`
    : statut === "conteste" ? "Avoir contesté par le fournisseur."
    : "Avoir annulé.";

  return (
    <section>
      <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-[0.05em] font-[650] mb-2">Avoir</div>
      <Banner tone={tone}>
        <div className="font-[550]">{label}</div>
        {statut === "conteste" && c.avoir_motif_contestation ? (
          <div className="text-[11.5px] mt-[2px]">Motif : {c.avoir_motif_contestation}</div>
        ) : null}
      </Banner>
      {statut === "conteste" ? (
        <div className="flex flex-col gap-[6px] mt-[10px]">
          <Button variant="secondary" onClick={() => forceAction("annule")} disabled={busy}>
            Annuler l&apos;avoir
          </Button>
          <Button variant="primary" onClick={() => forceAction("accepte")} disabled={busy}>
            Maintenir l&apos;avoir
          </Button>
        </div>
      ) : null}
    </section>
  );
}
