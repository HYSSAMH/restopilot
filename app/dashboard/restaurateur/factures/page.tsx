"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import type { StatutCommande } from "@/lib/supabase/types";
import { regenerateFacturePDF } from "@/lib/facture-from-db";
import FactureImportModal from "@/components/factures/FactureImportModal";
import { Pagination, paginate, PAGE_SIZE_DEFAULT } from "@/components/ui/Pagination";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, KpiCard } from "@/components/ui/Card";
import { Input, SearchInput, Select, Field } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableHead, TableRow, TableFooter } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Banner, pushToast } from "@/components/ui/Feedback";
import { Skeleton } from "@/components/ui/Loading";

interface Commande {
  id: string;
  fournisseur_id: string | null;
  fournisseur_externe_id: string | null;
  statut: StatutCommande;
  montant_total: number;
  avoir_montant: number | null;
  source: string | null;
  numero_facture_externe: string | null;
  pdf_path: string | null;
  created_at: string;
  lignes_commande: {
    id: string;
    nom_snapshot: string;
    prix_snapshot: number;
    unite: string;
    quantite: number;
  }[];
}

interface LignesByProduit {
  nom: string;
  totalQte: number;
  totalValeur: number;
  occurrences: { fournisseurId: string; fournisseurNom: string; prix: number; qte: number; date: string }[];
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

type StatutTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const STATUT_META: Record<StatutCommande, { label: string; tone: StatutTone }> = {
  recue: { label: "Reçue", tone: "warning" },
  en_preparation: { label: "En préparation", tone: "info" },
  en_livraison: { label: "En livraison", tone: "accent" },
  livree: { label: "Livrée", tone: "info" },
  receptionnee: { label: "Réceptionnée", tone: "success" },
  receptionnee_avec_anomalies: { label: "Anomalies", tone: "danger" },
  annulee: { label: "Annulée", tone: "neutral" },
};

const TABLE_COLS = "100px 1fr 90px 160px 120px 120px 220px";

export default function FacturesPage() {
  const [tab, setTab] = useState<"factures" | "produits">("factures");
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [cheaperAlerts, setCheaperAlerts] = useState<Record<string, { fournNom: string; prix: number }>>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDL] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [fournFilter, setFournFilter] = useState<"tous" | string>("tous");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [montantMin, setMontantMin] = useState<string>("");
  const [montantMax, setMontantMax] = useState<string>("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("commandes")
        .select(`
          id, fournisseur_id, fournisseur_externe_id, statut, montant_total, avoir_montant,
          source, numero_facture_externe, pdf_path, created_at,
          lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite )
        `)
        .eq("restaurateur_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      const typed = (data ?? []) as unknown as Commande[];
      setCommandes(typed);

      const fIds = Array.from(new Set(typed.map(c => c.fournisseur_id).filter((x): x is string => !!x)));
      const fExtIds = Array.from(new Set(typed.map(c => c.fournisseur_externe_id).filter((x): x is string => !!x)));
      const map: Record<string, string> = {};
      if (fIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, nom_commercial, nom_etablissement").in("id", fIds);
        (profs ?? []).forEach(p => { map[p.id] = p.nom_commercial || p.nom_etablissement || "—"; });
      }
      if (fExtIds.length > 0) {
        const { data: ext } = await supabase
          .from("fournisseurs_externes").select("id, nom").in("id", fExtIds);
        (ext ?? []).forEach(e => { map[e.id] = `${e.nom} (externe)`; });
      }
      setFournNames(map);

      const nomProduits = Array.from(new Set(
        typed.flatMap(c => c.lignes_commande.map(l => l.nom_snapshot.toLowerCase().trim())),
      ));
      if (nomProduits.length > 0) {
        const { data: tarifs } = await supabase
          .from("tarifs")
          .select("prix, unite, fournisseur_id, produits!inner ( nom )")
          .eq("actif", true).is("archived_at", null);
        type TarifRow = { prix: number; unite: string; fournisseur_id: string; produits: { nom: string } };
        const tarifsMap = new Map<string, { fournId: string; prix: number }[]>();
        ((tarifs ?? []) as unknown as TarifRow[]).forEach(t => {
          const key = t.produits.nom.toLowerCase().trim();
          if (!tarifsMap.has(key)) tarifsMap.set(key, []);
          tarifsMap.get(key)!.push({ fournId: t.fournisseur_id, prix: Number(t.prix) });
        });
        const dernierPrixPaye = new Map<string, number>();
        typed.slice().reverse().forEach(c => {
          c.lignes_commande.forEach(l => {
            dernierPrixPaye.set(l.nom_snapshot.toLowerCase().trim(), Number(l.prix_snapshot));
          });
        });
        const alerts: Record<string, { fournNom: string; prix: number }> = {};
        for (const [nom, paye] of dernierPrixPaye.entries()) {
          const candidats = tarifsMap.get(nom);
          if (!candidats) continue;
          const meilleur = candidats.reduce((m, c) => c.prix < m.prix ? c : m, candidats[0]);
          if (meilleur.prix < paye) {
            alerts[nom] = { fournNom: map[meilleur.fournId] ?? "—", prix: meilleur.prix };
          }
        }
        setCheaperAlerts(alerts);
      }

      setLoading(false);
    })();
  }, [reloadKey]);

  const filtered = useMemo(() => {
    let arr = commandes;
    if (fournFilter !== "tous") arr = arr.filter(c => (c.fournisseur_id ?? c.fournisseur_externe_id) === fournFilter);
    if (dateFrom) arr = arr.filter(c => c.created_at.slice(0, 10) >= dateFrom);
    if (dateTo) arr = arr.filter(c => c.created_at.slice(0, 10) <= dateTo);
    const min = parseFloat(montantMin);
    if (!isNaN(min) && min > 0) arr = arr.filter(c => Number(c.montant_total) >= min);
    const max = parseFloat(montantMax);
    if (!isNaN(max) && max > 0) arr = arr.filter(c => Number(c.montant_total) <= max);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(c => {
        const nom = (fournNames[c.fournisseur_id ?? c.fournisseur_externe_id ?? ""] ?? "").toLowerCase();
        const num = (c.numero_facture_externe ?? "").toLowerCase();
        return nom.includes(s) || num.includes(s) || c.id.toLowerCase().startsWith(s);
      });
    }
    return arr;
  }, [commandes, fournFilter, dateFrom, dateTo, montantMin, montantMax, search, fournNames]);

  useEffect(() => { setPage(1); }, [fournFilter, dateFrom, dateTo, montantMin, montantMax, search, tab]);

  const fournUniques = Array.from(new Set(commandes.map(c => c.fournisseur_id ?? c.fournisseur_externe_id).filter((x): x is string => !!x)));
  const totalFiltre = filtered.filter(c => c.statut !== "annulee").reduce((s, c) => s + Number(c.montant_total), 0);
  const nbAvoirs = commandes.filter(c => Number(c.avoir_montant) > 0).length;
  const nbImport = commandes.filter(c => c.source === "import").length;

  const parProduit: LignesByProduit[] = useMemo(() => {
    const map = new Map<string, LignesByProduit>();
    filtered.forEach(c => {
      const fournNom = fournNames[c.fournisseur_id ?? c.fournisseur_externe_id ?? ""] ?? "—";
      c.lignes_commande.forEach(l => {
        const key = l.nom_snapshot.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { nom: l.nom_snapshot, totalQte: 0, totalValeur: 0, occurrences: [] });
        }
        const p = map.get(key)!;
        p.totalQte += Number(l.quantite);
        p.totalValeur += Number(l.quantite) * Number(l.prix_snapshot);
        p.occurrences.push({
          fournisseurId: c.fournisseur_id ?? c.fournisseur_externe_id ?? "",
          fournisseurNom: fournNom,
          prix: Number(l.prix_snapshot),
          qte: Number(l.quantite),
          date: c.created_at,
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.totalValeur - a.totalValeur);
  }, [filtered, fournNames]);

  const hasFilters = !!(search || fournFilter !== "tous" || dateFrom || dateTo || montantMin || montantMax);

  async function download(id: string) {
    setDL(id);
    try { await regenerateFacturePDF(id); }
    catch (e) { console.error(e); pushToast("Erreur lors de la génération du PDF", { tone: "danger" }); }
    setDL(null);
  }

  async function viewOriginal(pdfPath: string) {
    const supa = createClient();
    const { data, error } = await supa.storage.from("factures-externes").createSignedUrl(pdfPath, 300);
    if (error || !data) { pushToast("Impossible d'ouvrir le PDF", { tone: "danger" }); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function downloadOriginal(pdfPath: string) {
    const supa = createClient();
    const { data, error } = await supa.storage.from("factures-externes").createSignedUrl(pdfPath, 300, { download: true });
    if (error || !data) { pushToast("Impossible de télécharger", { tone: "danger" }); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.click();
  }

  return (
    <DashboardLayout role="restaurateur">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Factures &amp; historique</h1>
          <p className="page-sub">
            <span className="mono tabular">{commandes.length}</span> facture{commandes.length > 1 ? "s" : ""} · import IA disponible.
          </p>
        </div>
        <Button variant="primary" iconLeft="upload" onClick={() => setImportOpen(true)}>
          Importer une facture
        </Button>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total factures" icon="file-text" value={<span className="mono tabular">{commandes.length}</span>} />
        <KpiCard label="Importées IA" icon="sparkles" value={<span className="mono tabular">{nbImport}</span>} />
        <KpiCard label="Avoirs actifs" icon="alert-triangle" value={<span className="mono tabular">{nbAvoirs}</span>} delta={nbAvoirs > 0 ? { value: "à suivre", trend: "down" } : undefined} />
        <KpiCard label="Total filtré" icon="euro" value={<span className="mono tabular">{fmt(totalFiltre).replace(" €", "")}</span>} unit=" €" />
      </section>

      {/* Tabs + filters */}
      <div className="mb-3">
        <Tabs
          items={[
            { id: "factures", label: "Factures", count: commandes.length },
            { id: "produits", label: "Par produit", count: parProduit.length },
          ]}
          value={tab}
          onChange={(id) => setTab(id as "factures" | "produits")}
        />
      </div>

      <section className="mb-4 rounded-[10px] border border-[var(--border)] bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <SearchInput value={search} onValueChange={setSearch} placeholder="N° facture, fournisseur, id…" />
          </div>
          <Select value={fournFilter} onChange={e => setFournFilter(e.target.value)}>
            <option value="tous">Tous fournisseurs</option>
            {fournUniques.map(id => (
              <option key={id} value={id}>{fournNames[id] ?? id.slice(0, 6)}</option>
            ))}
          </Select>
          <Field label="Du">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined} className="w-[150px]" />
          </Field>
          <Field label="Au">
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || undefined} className="w-[150px]" />
          </Field>
          <Field label="Min €">
            <Input type="number" min="0" step="0.01" value={montantMin} onChange={e => setMontantMin(e.target.value)} placeholder="0" className="w-[90px]" />
          </Field>
          <Field label="Max €">
            <Input type="number" min="0" step="0.01" value={montantMax} onChange={e => setMontantMax(e.target.value)} placeholder="∞" className="w-[90px]" />
          </Field>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              iconLeft="x"
              onClick={() => {
                setSearch(""); setFournFilter("tous"); setDateFrom(""); setDateTo("");
                setMontantMin(""); setMontantMax("");
              }}
            >
              Réinitialiser
            </Button>
          ) : null}
        </div>
      </section>

      {/* Content */}
      {loading ? (
        <Card>
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton width={92} height={14} />
                <Skeleton width="30%" height={14} />
                <Skeleton width={120} height={22} rounded={20} />
                <Skeleton width={80} height={14} className="ml-auto" />
                <Skeleton width={180} height={28} rounded={7} />
              </div>
            ))}
          </div>
        </Card>
      ) : tab === "factures" ? (
        filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={commandes.length === 0 ? "file-text" : "search"}
              title={commandes.length === 0 ? "Aucune facture encore" : "Aucun résultat"}
              sub={commandes.length === 0 ? "Importez une première facture PDF — la lecture IA extrait automatiquement les lignes." : "Ajustez vos filtres."}
              action={commandes.length === 0 ? (
                <Button variant="primary" iconLeft="upload" onClick={() => setImportOpen(true)}>
                  Importer ma première facture
                </Button>
              ) : undefined}
            />
          </Card>
        ) : (
          <Table>
            <TableHead columns={TABLE_COLS}>
              <div>Date</div>
              <div>Fournisseur</div>
              <div>N°</div>
              <div>Statut</div>
              <div className="text-right">HT</div>
              <div className="text-right">TTC</div>
              <div className="text-right">Actions</div>
            </TableHead>
            {paginate(filtered, page, PAGE_SIZE_DEFAULT).map((c) => {
              const ttc = Number(c.montant_total) * 1.10;
              const meta = STATUT_META[c.statut] ?? { label: c.statut, tone: "neutral" as StatutTone };
              const hasAvoir = Number(c.avoir_montant) > 0;
              return (
                <TableRow key={c.id} columns={TABLE_COLS}>
                  <div className="mono tabular text-[12.5px] text-[var(--text-muted)]">
                    {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })}
                  </div>
                  <div className="text-[13px] font-[550] text-[var(--text)] truncate">
                    {fournNames[c.fournisseur_id ?? c.fournisseur_externe_id ?? ""] ?? "—"}
                  </div>
                  <div className="mono tabular text-[11.5px] text-[var(--text-subtle)] truncate">
                    {c.numero_facture_externe ?? `#${c.id.slice(0, 6).toUpperCase()}`}
                  </div>
                  <div className="flex items-center gap-[4px] flex-wrap">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {hasAvoir ? (
                      <Badge tone="danger" icon="alert-triangle">
                        <span className="mono tabular">{fmt(Number(c.avoir_montant))}</span>
                      </Badge>
                    ) : null}
                    {c.source === "import" ? <Badge tone="accent" icon="sparkles">IA</Badge> : null}
                  </div>
                  <div className="mono tabular text-[13px] font-[600] text-[var(--text)] text-right">
                    {fmt(c.montant_total)}
                  </div>
                  <div className="mono tabular text-[12.5px] text-[var(--text-muted)] text-right">
                    {fmt(ttc)}
                  </div>
                  <div className="flex justify-end gap-1">
                    {c.source === "import" && c.pdf_path ? (
                      <>
                        <Button size="sm" variant="secondary" iconLeft="eye" onClick={() => viewOriginal(c.pdf_path!)}>Consulter</Button>
                        <Button size="sm" variant="secondary" iconLeft="download" onClick={() => downloadOriginal(c.pdf_path!)}>PDF</Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        iconLeft="download"
                        loading={downloading === c.id}
                        onClick={() => download(c.id)}
                      >
                        Générer PDF
                      </Button>
                    )}
                  </div>
                </TableRow>
              );
            })}
            <TableFooter
              left={<>{Math.min((page - 1) * PAGE_SIZE_DEFAULT + 1, filtered.length)}–{Math.min(page * PAGE_SIZE_DEFAULT, filtered.length)} sur {filtered.length}</>}
              right={<Pagination page={page} total={filtered.length} onChange={setPage} />}
            />
          </Table>
        )
      ) : (
        parProduit.length === 0 ? (
          <Card>
            <EmptyState icon="package" title="Aucune ligne d'achat" sub="Ajustez la période ou les filtres." />
          </Card>
        ) : (
          <div className="space-y-2">
            {parProduit.map((p) => {
              const alert = cheaperAlerts[p.nom.toLowerCase().trim()];
              const dernierPrix = p.occurrences[p.occurrences.length - 1]?.prix ?? 0;
              const economie = alert ? (dernierPrix - alert.prix) : 0;
              return (
                <details key={p.nom} className="group overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
                  <summary className="flex cursor-pointer items-center gap-3 p-4 list-none">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-[600] text-[var(--text)]">{p.nom}</p>
                        {alert ? (
                          <Badge tone="success" icon="tag">
                            {fmt(alert.prix)} chez {alert.fournNom} · −{fmt(economie)}/u
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[11.5px] text-[var(--text-muted)] mt-[2px]">
                        <span className="mono tabular">{p.occurrences.length}</span> achat{p.occurrences.length > 1 ? "s" : ""} ·{" "}
                        <span className="mono tabular">{p.totalQte}</span> unités · <span className="mono tabular font-[600] text-[var(--text)]">{fmt(p.totalValeur)}</span>
                      </p>
                    </div>
                    <Icon name="chevron-down" size={14} className="text-[var(--text-subtle)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] p-3">
                    <div className="overflow-x-auto bg-white border border-[var(--border)] rounded-[8px]">
                      <div
                        className="grid gap-3 px-3 py-[9px] border-b border-[var(--border)] text-[10.5px] font-[650] text-[var(--text-muted)] uppercase tracking-[0.04em]"
                        style={{ gridTemplateColumns: "120px 1fr 80px 110px 110px" }}
                      >
                        <div>Date</div>
                        <div>Fournisseur</div>
                        <div className="text-right">Qté</div>
                        <div className="text-right">P.U.</div>
                        <div className="text-right">Total</div>
                      </div>
                      {p.occurrences.map((o, i) => (
                        <div
                          key={i}
                          className="grid gap-3 px-3 py-[9px] text-[13px] border-b border-[var(--border)] last:border-b-0"
                          style={{ gridTemplateColumns: "120px 1fr 80px 110px 110px" }}
                        >
                          <div className="mono tabular text-[12.5px] text-[var(--text-muted)]">
                            {new Date(o.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </div>
                          <div className="truncate text-[var(--text)]">{o.fournisseurNom}</div>
                          <div className="mono tabular text-right text-[var(--text-muted)]">{o.qte}</div>
                          <div className="mono tabular text-right text-[var(--text-muted)]">{fmt(o.prix)}</div>
                          <div className="mono tabular text-right font-[600] text-[var(--text)]">{fmt(o.prix * o.qte)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )
      )}

      {/* Import modal */}
      {importOpen && (
        <FactureImportModal
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            setReloadKey(k => k + 1);
          }}
        />
      )}
    </DashboardLayout>
  );
}
