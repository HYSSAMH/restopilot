"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { generateAvoirPDF, type AvoirData } from "@/lib/avoir-pdf";
import { Button } from "@/components/ui/Button";
import { Card, KpiCard, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Modal";
import { Banner, pushToast } from "@/components/ui/Feedback";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Loading";
import { Icon } from "@/components/ui/Icon";

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

const SUP_GRADIENTS = [
  "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
  "linear-gradient(135deg, #EC4899 0%, #F97316 100%)",
];

function supplierGradient(key: string) {
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return SUP_GRADIENTS[Math.abs(h) % SUP_GRADIENTS.length];
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function dayBucket(iso: string): { key: string; label: string; sort: number } {
  const d = new Date(iso);
  const today = new Date();
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(d) - dayStart(today)) / (86400 * 1000));
  if (diff === 0) return { key: "today", label: "Aujourd'hui", sort: 0 };
  if (diff === -1) return { key: "yesterday", label: "Hier", sort: 1 };
  if (diff < -1 && diff >= -6) return { key: "week", label: "Cette semaine", sort: 2 };
  return { key: "older", label: "Plus ancien", sort: 3 };
}

export default function ReceptionsPage() {
  const { profile } = useProfile();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [fournMap, setFournMap] = useState<Record<string, FournProfile>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [submitting, setSubmitting] = useState(false);

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

  function openCommande(c: Commande) {
    setOpenId(c.id);
    const map: Record<string, LineState> = {};
    c.lignes_commande.forEach(l => {
      map[l.id] = {
        ...l,
        editQte: (l.quantite_recue ?? l.quantite).toString(),
        editQualite: l.qualite ?? "conforme",
        editMotif: l.motif_anomalie ?? "",
      };
    });
    setLines(map);
  }

  function updateLine(id: string, patch: Partial<LineState>) {
    setLines(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const opened = commandes.find(c => c.id === openId) ?? null;

  // Calcul avoir live basé sur l'état des lignes en cours d'édition
  const liveAvoirMontant = useMemo(() => {
    if (!opened) return 0;
    let total = 0;
    for (const l of opened.lignes_commande) {
      const ls = lines[l.id];
      if (!ls) continue;
      const qteRecue = parseFloat(ls.editQte);
      if (isNaN(qteRecue)) continue;
      if (ls.editQualite === "non_conforme") {
        total += l.quantite * l.prix_snapshot;
      } else if (qteRecue < l.quantite) {
        total += (l.quantite - qteRecue) * l.prix_snapshot;
      }
    }
    return Math.round(total * 100) / 100;
  }, [opened, lines]);

  async function handleValidate(c: Commande) {
    setSubmitting(true);
    const supabase = createClient();
    try {
      let hasAnomalie = false;
      let avoirMontant = 0;
      const avoirLignes: AvoirData["lignes"] = [];

      for (const l of c.lignes_commande) {
        const ls = lines[l.id];
        if (!ls) continue;
        const qteRecue = parseFloat(ls.editQte);
        const qualite = ls.editQualite;
        const motif = qualite === "non_conforme" ? ls.editMotif.trim() : null;

        if (qualite === "non_conforme" && !motif) {
          throw new Error(`Motif requis pour la ligne "${l.nom_snapshot}".`);
        }

        const anomalie = qteRecue < l.quantite || qualite === "non_conforme";
        if (anomalie) {
          hasAnomalie = true;
          const ecart = Math.max(0, l.quantite - qteRecue);
          const montant = qualite === "non_conforme"
            ? l.quantite * l.prix_snapshot
            : ecart * l.prix_snapshot;
          avoirMontant += montant;
          if (montant > 0) {
            avoirLignes.push({
              nom: l.nom_snapshot,
              unite: l.unite,
              prix_unitaire: l.prix_snapshot,
              qte_commandee: l.quantite,
              qte_recue: qualite === "non_conforme" ? 0 : qteRecue,
              motif: qualite === "non_conforme" ? motif! : "Manquant",
            });
          }
        }

        await supabase.from("lignes_commande").update({
          quantite_recue: qteRecue,
          qualite,
          motif_anomalie: motif,
        }).eq("id", l.id);
      }

      await supabase.from("commandes").update({
        statut: hasAnomalie ? "receptionnee_avec_anomalies" : "receptionnee",
        receptionnee_at: new Date().toISOString(),
        avoir_montant: Math.round(avoirMontant * 100) / 100,
        avoir_statut: hasAnomalie ? "en_attente" : null,
      }).eq("id", c.id);

      if (hasAnomalie && avoirLignes.length > 0) {
        const f = fournMap[c.fournisseur_id];
        const ref = `AV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
        await generateAvoirPDF({
          reference: ref,
          commandeRef: c.id.slice(0, 8).toUpperCase(),
          date: new Date().toLocaleDateString("fr-FR"),
          lignes: avoirLignes,
          buyer: {
            nom: profile?.nom_commercial || profile?.nom_etablissement || "Restaurateur",
            raison: profile?.raison_sociale ?? null,
            siret: profile?.siret ?? null,
            adresse: profile?.adresse_ligne1 ?? null,
            cp_ville: [profile?.code_postal, profile?.ville].filter(Boolean).join(" ") || null,
          },
          seller: f ? {
            nom: f.nom_commercial || f.nom_etablissement || "Fournisseur",
            raison: f.raison_sociale,
            siret: f.siret,
            adresse: f.adresse_ligne1,
            cp_ville: [f.code_postal, f.ville].filter(Boolean).join(" ") || null,
          } : null,
        });
      }

      setOpenId(null);
      pushToast(
        hasAnomalie
          ? `Réception validée avec anomalies. Avoir de ${fmt(avoirMontant)} généré.`
          : "Réception validée. Aucune anomalie.",
        { tone: hasAnomalie ? "warning" : "success" },
      );
      fetchCommandes();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      pushToast(msg, { tone: "danger" });
    }
    setSubmitting(false);
  }

  // Stats haut
  const nbToday = commandes.filter(c => dayBucket(c.created_at).key === "today").length;
  const nbWeek = commandes.filter(c => ["today", "yesterday", "week"].includes(dayBucket(c.created_at).key)).length;
  const totalLines = commandes.reduce((s, c) => s + (c.lignes_commande?.length ?? 0), 0);
  const totalMontant = commandes.reduce((s, c) => s + Number(c.montant_total ?? 0), 0);

  // Groupement par jour
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; sort: number; items: Commande[] }>();
    for (const c of commandes) {
      const b = dayBucket(c.created_at);
      if (!map.has(b.key)) map.set(b.key, { label: b.label, sort: b.sort, items: [] });
      map.get(b.key)!.items.push(c);
    }
    return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
  }, [commandes]);

  return (
    <DashboardLayout role="restaurateur">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">À réceptionner</h1>
          <p className="page-sub">Pointez les livraisons, générez les avoirs automatiquement en cas d&apos;anomalie.</p>
        </div>
      </header>

      {/* Stats row */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Aujourd'hui" icon="package" value={<span className="mono tabular">{nbToday}</span>} />
        <KpiCard label="Cette semaine" icon="calendar-days" value={<span className="mono tabular">{nbWeek}</span>} />
        <KpiCard label="Lignes à pointer" icon="clipboard-list" value={<span className="mono tabular">{totalLines}</span>} />
        <KpiCard label="Montant total" icon="euro" value={<span className="mono tabular">{fmt(totalMontant).replace(" €", "")}</span>} unit=" €" />
      </section>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <Card key={i} className="p-4 flex items-center gap-3">
              <Skeleton width={44} height={44} rounded={8} />
              <div className="flex-1">
                <Skeleton width="40%" height={14} />
                <Skeleton width="60%" height={12} className="mt-2" />
              </div>
              <Skeleton width={110} height={36} rounded={8} />
            </Card>
          ))}
        </div>
      ) : commandes.length === 0 ? (
        <Card>
          <EmptyState
            icon="check-circle"
            title="Aucune livraison en attente"
            sub="Toutes vos commandes livrées ont été réceptionnées."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.label}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-[650] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                  {g.label}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  <span className="mono tabular">{g.items.length}</span> livraison{g.items.length > 1 ? "s" : ""}
                </div>
              </div>
              <div className="space-y-2">
                {g.items.map((c) => {
                  const f = fournMap[c.fournisseur_id];
                  const display = f?.nom_commercial || f?.nom_etablissement || "Fournisseur";
                  return (
                    <Card
                      key={c.id}
                      className="p-4 flex flex-wrap items-center gap-3 hover:border-[var(--border-strong)] transition-colors"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-[8px] text-white text-[13px] font-[650]"
                        style={{ background: supplierGradient(c.fournisseur_id) }}
                      >
                        {display.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-[600] text-[var(--text)] truncate">{display}</span>
                          <Badge tone="warning">Livrée · à pointer</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px] text-[var(--text-muted)]">
                          <span className="mono tabular inline-flex items-center gap-1">
                            <Icon name="clock" size={11} />
                            {new Date(c.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="mono tabular inline-flex items-center gap-1">
                            <Icon name="package" size={11} />
                            {c.lignes_commande.length} ligne{c.lignes_commande.length > 1 ? "s" : ""}
                          </span>
                          <span className="mono tabular inline-flex items-center gap-1 font-[600] text-[var(--text)]">
                            {fmt(c.montant_total)}
                          </span>
                        </div>
                      </div>
                      <Button variant="primary" iconLeft="check-circle" onClick={() => openCommande(c)}>
                        Pointer
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Drawer réception */}
      <Drawer
        open={!!opened}
        onClose={() => setOpenId(null)}
        width={640}
        title={opened ? (
          <span>
            BL · <span className="mono tabular">{opened.id.slice(0, 8).toUpperCase()}</span>
          </span>
        ) : undefined}
        sub={opened ? (fournMap[opened.fournisseur_id]?.nom_commercial || fournMap[opened.fournisseur_id]?.nom_etablissement || "Fournisseur") : undefined}
        actions={
          opened ? (
            <>
              <div className="flex items-center justify-between text-[13px] mb-1">
                <span className="text-[var(--text-muted)]">Avoir estimé</span>
                <span className={`mono tabular font-[650] ${liveAvoirMontant > 0 ? "text-[var(--danger)]" : "text-[var(--text)]"}`}>
                  {fmt(liveAvoirMontant)}
                </span>
              </div>
              <Button
                variant="primary"
                iconLeft="check-circle"
                onClick={() => handleValidate(opened)}
                disabled={submitting}
                loading={submitting}
              >
                Signer et clôturer
              </Button>
            </>
          ) : undefined
        }
      >
        {opened ? (
          <div className="space-y-4">
            <Banner tone="info">
              Ajustez les quantités reçues et marquez les lignes non conformes. L&apos;avoir PDF est généré automatiquement à la validation.
            </Banner>

            <div className="bg-white border border-[var(--border)] rounded-[10px] overflow-hidden">
              <div
                className="grid gap-3 px-3 py-[10px] bg-[var(--bg-subtle)] border-b border-[var(--border)] text-[10.5px] font-[650] text-[var(--text-muted)] uppercase tracking-[0.04em]"
                style={{ gridTemplateColumns: "1fr 80px 100px 100px 160px" }}
              >
                <div>Produit</div>
                <div className="text-right">Attendu</div>
                <div className="text-right">Reçu</div>
                <div className="text-center">Qualité</div>
                <div>Motif</div>
              </div>
              {opened.lignes_commande.map((l) => {
                const ls = lines[l.id];
                if (!ls) return null;
                const qteRecue = parseFloat(ls.editQte);
                const nonConf = ls.editQualite === "non_conforme";
                const ecart = !isNaN(qteRecue) && qteRecue < l.quantite;
                return (
                  <div
                    key={l.id}
                    className="grid items-center gap-3 px-3 py-[10px] border-b border-[var(--border)] last:border-b-0"
                    style={{ gridTemplateColumns: "1fr 80px 100px 100px 160px" }}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-[550] text-[var(--text)] truncate">{l.nom_snapshot}</div>
                      <div className="mono tabular text-[11px] text-[var(--text-muted)]">{fmt(l.prix_snapshot)} / {l.unite}</div>
                    </div>
                    <div className="mono tabular text-[12.5px] text-[var(--text-muted)] text-right">
                      {l.quantite} {l.unite}
                    </div>
                    <div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ls.editQte}
                        onChange={(e) => updateLine(l.id, { editQte: e.target.value })}
                        className={[
                          "text-right mono tabular",
                          nonConf ? "border-[var(--danger)]" : ecart ? "border-[var(--warning)]" : "",
                        ].join(" ")}
                      />
                    </div>
                    <div className="flex justify-center gap-[2px]">
                      <button
                        type="button"
                        onClick={() => updateLine(l.id, { editQualite: "conforme" })}
                        aria-label="Conforme"
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors",
                          !nonConf
                            ? "bg-[var(--success)] text-white"
                            : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]",
                        ].join(" ")}
                      >
                        <Icon name="check" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLine(l.id, { editQualite: "non_conforme" })}
                        aria-label="Non conforme"
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors",
                          nonConf
                            ? "bg-[var(--danger)] text-white"
                            : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]",
                        ].join(" ")}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    <div>
                      {nonConf ? (
                        <Select
                          value={ls.editMotif}
                          onChange={(e) => updateLine(l.id, { editMotif: e.target.value })}
                        >
                          <option value="">— Motif —</option>
                          {MOTIFS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Select>
                      ) : ecart ? (
                        <span className="text-[11.5px] text-[var(--warning)] font-[550]">Écart quantité</span>
                      ) : (
                        <span className="text-[11.5px] text-[var(--text-subtle)]">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Drawer>
    </DashboardLayout>
  );
}
