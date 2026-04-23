"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt } from "@/lib/gestion-data";
import { Icon } from "@/components/ui/Icon";

interface CARow { date: string; ca_total: number }
interface Commande { id: string; statut: string; montant_total: number; avoir_statut: string | null; avoir_montant: number | null; created_at: string; fournisseur_id: string | null; fournisseur_externe_id: string | null; source: string | null }
interface Charge { id: string; nom: string; montant: number; jour_prelevement: number | null; actif: boolean }
interface Tarif { id: string; prix: number; prix_precedent: number | null; produit_nom: string }

const OBJECTIF_KEY = "restopilot_budget_config";

export default function RestaurateurHome() {
  const { profile, displayName } = useProfile();
  const supa = useMemo(() => createClient(), []);

  const [caRows, setCaRows]           = useState<CARow[]>([]);
  const [commandes, setCommandes]     = useState<Commande[]>([]);
  const [charges, setCharges]         = useState<Charge[]>([]);
  const [tarifsVar, setTarifsVar]     = useState<Tarif[]>([]);
  const [loading, setLoading]         = useState(true);
  const [objectifPct, setObjectifPct] = useState(28);
  const [objectifCaJour, setObjectifCaJour] = useState(0);

  // Chargement objectif depuis localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OBJECTIF_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.objectifPct   === "number") setObjectifPct(p.objectifPct);
        if (typeof p.objectifCaJour === "number") setObjectifCaJour(p.objectifCaJour);
      }
    } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const today = new Date();
    const weekAgo     = new Date(today); weekAgo.setDate(today.getDate() - 7);
    const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);
    const monthStart  = new Date(today.getFullYear(), today.getMonth(), 1);

    const [caRes, cmdRes, chgRes, tarifRes] = await Promise.all([
      supa.from("ca_journalier")
          .select("date, ca_total")
          .eq("restaurateur_id", profile.id)
          .gte("date", twoWeeksAgo.toISOString().slice(0, 10))
          .order("date", { ascending: false }),
      supa.from("commandes")
          .select("id, statut, montant_total, avoir_statut, avoir_montant, created_at, fournisseur_id, fournisseur_externe_id, source")
          .eq("restaurateur_id", profile.id)
          .gte("created_at", monthStart.toISOString())
          .order("created_at", { ascending: false })
          .limit(100),
      supa.from("charges_recurrentes")
          .select("id, nom, montant, jour_prelevement, actif")
          .eq("restaurateur_id", profile.id)
          .eq("actif", true),
      supa.from("tarifs")
          .select("id, prix, prix_precedent, produits(nom)")
          .eq("actif", true)
          .not("prix_precedent", "is", null),
    ]);

    setCaRows((caRes.data ?? []) as CARow[]);
    setCommandes((cmdRes.data ?? []) as Commande[]);
    setCharges((chgRes.data ?? []) as Charge[]);
    type TR = { id: string; prix: number; prix_precedent: number | null; produits: { nom: string } | null };
    const tarifsWithName: Tarif[] = ((tarifRes.data ?? []) as unknown as TR[]).map(t => ({
      id: t.id, prix: Number(t.prix), prix_precedent: t.prix_precedent != null ? Number(t.prix_precedent) : null,
      produit_nom: t.produits?.nom ?? "—",
    }));
    setTarifsVar(tarifsWithName);
    setLoading(false);
  }, [supa, profile?.id]);

  useEffect(() => { load(); }, [load]);

  const today    = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const moisKey  = todayKey.slice(0, 7);

  // ── CA ──
  const caToday = caRows.filter(r => r.date === todayKey).reduce((s, r) => s + Number(r.ca_total), 0);
  const caWeek  = useMemo(() => {
    const d = new Date(today); d.setDate(today.getDate() - 7);
    return caRows.filter(r => new Date(r.date) >= d).reduce((s, r) => s + Number(r.ca_total), 0);
  }, [caRows, today]);
  const caPrevWeek = useMemo(() => {
    const a = new Date(today); a.setDate(today.getDate() - 14);
    const b = new Date(today); b.setDate(today.getDate() - 7);
    return caRows.filter(r => { const d = new Date(r.date); return d >= a && d < b; })
                 .reduce((s, r) => s + Number(r.ca_total), 0);
  }, [caRows, today]);
  const deltaWeek = caPrevWeek > 0 ? ((caWeek - caPrevWeek) / caPrevWeek) * 100 : 0;

  const caMois = caRows.filter(r => r.date.startsWith(moisKey)).reduce((s, r) => s + Number(r.ca_total), 0);
  const depMois = commandes.filter(c => c.statut !== "annulee").reduce((s, c) => s + Number(c.montant_total), 0);
  const coutMatiereMoisPct = caMois > 0 ? (depMois / caMois) * 100 : 0;

  // Progression objectif CA jour
  const progrJour = objectifCaJour > 0 ? Math.min(100, (caToday / objectifCaJour) * 100) : 0;

  // ── Alertes ──
  const derniereCommandes = commandes.slice(0, 3);
  const avoirsEnAttente   = commandes.filter(c => c.avoir_statut === "en_attente" || c.avoir_statut === "conteste").length;
  const haussesPrix = tarifsVar.filter(t =>
    t.prix_precedent != null && t.prix_precedent > 0
    && ((t.prix - t.prix_precedent) / t.prix_precedent) > 0.10,
  );
  const now = new Date();
  const in7 = new Date(); in7.setDate(now.getDate() + 7);
  const prochainsPrelevements = charges
    .filter(c => c.jour_prelevement)
    .map(c => {
      const d = new Date(now.getFullYear(), now.getMonth(), c.jour_prelevement!);
      if (d < now) d.setMonth(d.getMonth() + 1);
      return { charge: c, date: d };
    })
    .filter(x => x.date <= in7)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstName = profile?.prenom || profile?.nom_commercial || displayName;
  const hasAlertes = avoirsEnAttente > 0 || haussesPrix.length > 0 || prochainsPrelevements.length > 0;

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">Bonjour{firstName ? ` ${firstName}` : ""}</h1>
            <p className="page-sub">Vue d&apos;ensemble de votre activité.</p>
          </div>
          <Link href="/profile"
                className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-[7px] text-[13px] font-[550] text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)]">
            Mon profil
          </Link>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        ) : (
          <>
            {/* KPIs + objectif jour */}
            <section className="mb-5 rounded-[12px] border border-[var(--border)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-upper">CA du jour</p>
                  <p className="mono mt-1 text-[32px] font-[650] leading-none tracking-[-0.025em] text-[var(--text)]">{fmt(caToday)}</p>
                  {objectifCaJour > 0 && (
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                      Objectif : <span className="mono font-[600] text-[var(--text)]">{fmt(objectifCaJour)}</span> · <span className="mono">{progrJour.toFixed(0)}%</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="label-upper">CA 7 jours</p>
                  <p className="mono mt-1 text-[22px] font-[650] tracking-[-0.02em] text-[var(--text)]">{fmt(caWeek)}</p>
                  {caPrevWeek > 0 && (
                    <span className={`kpi-delta mt-1 inline-flex ${deltaWeek >= 0 ? "up" : "down"}`}>
                      <span className="mono">{deltaWeek >= 0 ? "+" : ""}{deltaWeek.toFixed(1)}%</span>
                      <span className="ml-1 text-[10.5px] text-[var(--text-muted)]">vs S-1</span>
                    </span>
                  )}
                </div>
              </div>
              {objectifCaJour > 0 && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${progrJour >= 100 ? "bg-emerald-500" : progrJour >= 70 ? "bg-indigo-500" : "bg-amber-400"}`}
                    style={{ width: `${progrJour}%` }}
                  />
                </div>
              )}
              {objectifCaJour === 0 && (
                <div className="mt-3 rounded-lg bg-indigo-50/60 px-3 py-2 text-xs text-indigo-700">
                  💡 Définissez un objectif de CA journalier dans{" "}
                  <Link href="/dashboard/restaurateur/gestion/budget" className="underline">Budget</Link>{" "}
                  pour voir votre progression en direct.
                </div>
              )}
            </section>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Kpi label={`CA mois ${moisKey}`}   value={fmt(caMois)} />
              <Kpi label="Dépenses mois"          value={fmt(depMois)} />
              <Kpi label="Coût matière %"          value={`${coutMatiereMoisPct.toFixed(1)}%`}
                   sub={`objectif ${objectifPct}%`}
                   accent={coutMatiereMoisPct > objectifPct ? "rose" : "emerald"} />
            </div>

            {/* Alertes */}
            {hasAlertes && (
              <section className="mb-5 rounded-[12px] border border-[var(--warning-soft)] bg-[var(--warning-soft)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rp-status-dot pulse" style={{ color: "var(--warning)" }} />
                  <p className="text-[13px] font-[600] text-[#B45309]">Alertes en cours</p>
                </div>
                <ul className="space-y-1 text-[12px] text-[#92400E]">
                  {avoirsEnAttente > 0 && (
                    <li>· <Link href="/dashboard/restaurateur/historique" className="underline hover:no-underline"><span className="mono">{avoirsEnAttente}</span> avoir{avoirsEnAttente > 1 ? "s" : ""} en attente</Link></li>
                  )}
                  {haussesPrix.slice(0, 3).map(t => {
                    const delta = ((t.prix - (t.prix_precedent ?? 1)) / (t.prix_precedent ?? 1)) * 100;
                    return (
                      <li key={t.id}>· {t.produit_nom} : <span className="mono font-[600]">+{delta.toFixed(1)}%</span> de hausse (prix fournisseur)</li>
                    );
                  })}
                  {haussesPrix.length > 3 && (
                    <li>· <Link href="/dashboard/restaurateur/menu/mercuriale" className="underline">voir les {haussesPrix.length - 3} autres hausses</Link></li>
                  )}
                  {prochainsPrelevements.slice(0, 3).map(p => (
                    <li key={p.charge.id}>
                      · Prélèvement <span className="font-[600]">{p.charge.nom}</span> de <span className="mono">{fmt(Number(p.charge.montant))}</span> le <span className="mono">{p.date.toLocaleDateString("fr-FR")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Raccourcis */}
            <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Shortcut href="/dashboard/restaurateur/commandes"          iconName="shopping-cart" title="Passer une commande" desc="Parcourez le catalogue fournisseurs" />
              <Shortcut href="/dashboard/restaurateur/gestion/saisie-ca" iconName="euro"          title="Saisir mon CA"         desc="Recette du jour ou du mois" />
              <Shortcut href="/dashboard/restaurateur/factures"           iconName="file-text"     title="Importer une facture"  desc="Analyse automatique" />
              <Shortcut href="/dashboard/restaurateur/menu"               iconName="chef-hat"      title="Nouvelle fiche technique" desc="Composer un plat, suivre les coûts" />
            </section>

            {/* Dernières commandes */}
            <section className="rounded-[12px] border border-[var(--border)] bg-white">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-[14px]">
                <h3 className="text-[14px] font-[600] tracking-[-0.01em] text-[var(--text)]">Dernières commandes</h3>
                <Link href="/dashboard/restaurateur/historique" className="text-[12px] font-[550] text-[var(--accent)] hover:underline">Voir tout →</Link>
              </div>
              {derniereCommandes.length === 0 ? (
                <p className="px-4 py-5 text-[13px] text-[var(--text-muted)]">Aucune commande récente.</p>
              ) : (
                <ul>
                  {derniereCommandes.map((c, i) => (
                    <li key={c.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}>
                      <div className="flex-1 min-w-[180px]">
                        <p className="mono text-[12.5px] font-[600] text-[var(--text)]">
                          {c.source === "import" ? "Facture importée" : `CMD-${c.id.slice(0, 6).toUpperCase()}`}
                        </p>
                        <p className="text-[11.5px] text-[var(--text-muted)]">
                          {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <span className="rp-badge neutral">{c.statut}</span>
                      <span className="mono text-[13px] font-[600] text-[var(--text)]">{fmt(Number(c.montant_total))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "rose" | "emerald" }) {
  const border = accent === "rose"    ? "border-[var(--danger-soft)]"
               : accent === "emerald" ? "border-[var(--success-soft)]"
               : "border-[var(--border)]";
  const txt    = accent === "rose"    ? "text-[var(--danger)]"
               : accent === "emerald" ? "text-[var(--success)]"
               : "text-[var(--text)]";
  return (
    <div className={`rounded-[12px] border ${border} bg-white p-4 transition-colors hover:border-[var(--border-strong)]`}>
      <p className="label-upper">{label}</p>
      <p className={`mono mt-2 text-[22px] font-[650] tracking-[-0.02em] leading-[1.1] ${txt}`}>{value}</p>
      {sub && <p className="mt-1 text-[11.5px] text-[var(--text-subtle)]">{sub}</p>}
    </div>
  );
}

function Shortcut({ href, iconName, title, desc }: {
  href: string;
  iconName: "shopping-cart" | "euro" | "file-text" | "chef-hat";
  title: string; desc: string;
}) {
  return (
    <Link href={href}
          className="group flex flex-col gap-3 rounded-[12px] border border-[var(--border)] bg-white p-4 transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--bg-subtle)]">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-[8px] text-white"
        style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" }}
      >
        <Icon name={iconName} size={18} />
      </div>
      <div>
        <p className="text-[14px] font-[600] tracking-[-0.01em] text-[var(--text)]">{title}</p>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{desc}</p>
      </div>
    </Link>
  );
}
