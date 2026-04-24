"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import { fmt } from "@/lib/gestion-data";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Card, KpiCard } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Feedback";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Loading";

interface CARow { date: string; ca_total: number }
interface Commande {
  id: string;
  statut: string;
  montant_total: number;
  avoir_statut: string | null;
  avoir_montant: number | null;
  created_at: string;
  fournisseur_id: string | null;
  fournisseur_externe_id: string | null;
  source: string | null;
}
interface Charge { id: string; nom: string; montant: number; jour_prelevement: number | null; actif: boolean }
interface Tarif { id: string; prix: number; prix_precedent: number | null; produit_nom: string }

const OBJECTIF_KEY = "restopilot_budget_config";

export default function RestaurateurHome() {
  const { profile, displayName } = useProfile();
  const supa = useMemo(() => createClient(), []);

  const [caRows, setCaRows] = useState<CARow[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [tarifsVar, setTarifsVar] = useState<Tarif[]>([]);
  const [loading, setLoading] = useState(true);
  const [objectifPct, setObjectifPct] = useState(28);
  const [objectifCaJour, setObjectifCaJour] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OBJECTIF_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.objectifPct === "number") setObjectifPct(p.objectifPct);
        if (typeof p.objectifCaJour === "number") setObjectifCaJour(p.objectifCaJour);
      }
    } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const today = new Date();
    const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

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
      id: t.id,
      prix: Number(t.prix),
      prix_precedent: t.prix_precedent != null ? Number(t.prix_precedent) : null,
      produit_nom: t.produits?.nom ?? "—",
    }));
    setTarifsVar(tarifsWithName);
    setLoading(false);
  }, [supa, profile?.id]);

  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const moisKey = todayKey.slice(0, 7);

  // CA aggregations
  const caToday = caRows.filter(r => r.date === todayKey).reduce((s, r) => s + Number(r.ca_total), 0);
  const caWeek = useMemo(() => {
    const d = new Date(today); d.setDate(today.getDate() - 7);
    return caRows.filter(r => new Date(r.date) >= d).reduce((s, r) => s + Number(r.ca_total), 0);
  }, [caRows, today]);
  const caPrevWeek = useMemo(() => {
    const a = new Date(today); a.setDate(today.getDate() - 14);
    const b = new Date(today); b.setDate(today.getDate() - 7);
    return caRows
      .filter(r => { const d = new Date(r.date); return d >= a && d < b; })
      .reduce((s, r) => s + Number(r.ca_total), 0);
  }, [caRows, today]);
  const deltaWeek = caPrevWeek > 0 ? ((caWeek - caPrevWeek) / caPrevWeek) * 100 : 0;

  // 7-day bar chart data (most recent day last)
  const last7Days = useMemo(() => {
    const out: { day: string; ca: number; key: string }[] = [];
    const daysFR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const ca = caRows.filter(r => r.date === key).reduce((s, r) => s + Number(r.ca_total), 0);
      out.push({ day: daysFR[d.getDay()], ca, key });
    }
    return out;
  }, [caRows, today]);

  // 7-day sparkline for CA day card
  const caSpark = last7Days.map(d => d.ca || 0);

  // Last 14 days split into two halves for delta sparks
  const caMois = caRows.filter(r => r.date.startsWith(moisKey)).reduce((s, r) => s + Number(r.ca_total), 0);
  const depMois = commandes.filter(c => c.statut !== "annulee").reduce((s, c) => s + Number(c.montant_total), 0);
  const coutMatiereMoisPct = caMois > 0 ? (depMois / caMois) * 100 : 0;
  const cmdCount = commandes.length;

  const progrJour = objectifCaJour > 0 ? Math.min(100, (caToday / objectifCaJour) * 100) : 0;

  // Alerts
  const derniereCommandes = commandes.slice(0, 4);
  const avoirsEnAttente = commandes.filter(c => c.avoir_statut === "en_attente" || c.avoir_statut === "conteste").length;
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

  type AlertKind = "danger" | "warning" | "info" | "success";
  interface AlertItem { kind: AlertKind; title: string; desc: string; time?: string; href?: string }
  const alerts: AlertItem[] = [];
  if (avoirsEnAttente > 0) {
    alerts.push({
      kind: "warning",
      title: `${avoirsEnAttente} avoir${avoirsEnAttente > 1 ? "s" : ""} en attente`,
      desc: "À suivre avec les fournisseurs concernés",
      href: "/dashboard/restaurateur/historique",
    });
  }
  haussesPrix.slice(0, 2).forEach(t => {
    const delta = ((t.prix - (t.prix_precedent ?? 1)) / (t.prix_precedent ?? 1)) * 100;
    alerts.push({
      kind: "danger",
      title: `Hausse de prix : ${t.produit_nom}`,
      desc: `+${delta.toFixed(1)}% vs dernier tarif fournisseur`,
      href: "/dashboard/restaurateur/menu/mercuriale",
    });
  });
  prochainsPrelevements.slice(0, 2).forEach(p => {
    alerts.push({
      kind: "info",
      title: `Prélèvement ${p.charge.nom}`,
      desc: `${fmt(Number(p.charge.montant))} prévu le ${p.date.toLocaleDateString("fr-FR")}`,
      href: "/dashboard/restaurateur/gestion/tresorerie",
    });
  });
  if (objectifPct > 0 && coutMatiereMoisPct > objectifPct) {
    alerts.push({
      kind: "warning",
      title: `Coût matière au-dessus de l'objectif`,
      desc: `${coutMatiereMoisPct.toFixed(1)}% ce mois-ci (objectif ${objectifPct}%)`,
      href: "/dashboard/restaurateur/gestion/budget",
    });
  }

  const firstName = profile?.prenom || profile?.nom_commercial || displayName;
  const etablissement = profile?.nom_commercial || profile?.nom_etablissement || "votre établissement";
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <DashboardLayout role="restaurateur" hasNotification={alerts.length > 0}>
      {/* Header page */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">
            Bonjour{firstName ? ` ${firstName}` : ""}
          </h1>
          <p className="page-sub capitalize">
            {dateLabel} · État de <span className="lowercase">{etablissement}</span> aujourd&apos;hui.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" iconLeft="calendar-days" iconRight="chevron-down">
            Aujourd&apos;hui
          </Button>
          <Button variant="secondary" iconLeft="download">Exporter</Button>
          <Link href="/dashboard/restaurateur/commandes">
            <Button variant="primary" iconLeft="plus">Commander</Button>
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="kpi-card h-[112px]">
              <Skeleton width="60%" height={10} className="mb-3" />
              <Skeleton width="80%" height={24} />
              <Skeleton width="40%" height={10} className="mt-3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Row 1 : 4 KPI cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="CA du jour"
              icon="euro"
              value={<span className="mono tabular">{fmt(caToday).replace(" €", "")}</span>}
              unit=" €"
              sparkline={<Sparkline data={caSpark} color="#10B981" />}
            />
            <KpiCard
              label="CA 7 jours"
              icon="trending-up"
              value={<span className="mono tabular">{fmt(caWeek).replace(" €", "")}</span>}
              unit=" €"
              delta={
                caPrevWeek > 0
                  ? {
                      value: `${deltaWeek >= 0 ? "+" : ""}${deltaWeek.toFixed(1)}%`,
                      trend: deltaWeek > 0 ? "up" : deltaWeek < 0 ? "down" : "flat",
                    }
                  : undefined
              }
              sparkline={<Sparkline data={caSpark} color="#6366F1" />}
            />
            <KpiCard
              label="Coût matière mois"
              icon="scale"
              value={<span className="mono tabular">{coutMatiereMoisPct.toFixed(1)}</span>}
              unit="%"
              delta={{
                value: `obj. ${objectifPct}%`,
                trend: coutMatiereMoisPct > objectifPct ? "down" : "up",
              }}
            />
            <KpiCard
              label="Commandes mois"
              icon="shopping-cart"
              value={<span className="mono tabular">{cmdCount}</span>}
              delta={{
                value: fmt(depMois),
                trend: "flat",
              }}
            />
          </section>

          {/* Objectif CA jour — progress bar si défini */}
          {objectifCaJour > 0 ? (
            <section className="mt-3 rounded-[10px] border border-[var(--border)] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-upper">Objectif CA du jour</p>
                  <p className="mono tabular mt-[2px] text-[13px] text-[var(--text)]">
                    <span className="font-[650]">{fmt(caToday)}</span>
                    <span className="text-[var(--text-muted)]"> / {fmt(objectifCaJour)}</span>
                    <span className="ml-2 text-[11.5px] text-[var(--text-muted)]">({progrJour.toFixed(0)}%)</span>
                  </p>
                </div>
                <Link
                  href="/dashboard/restaurateur/gestion/saisie-ca"
                  className="text-[12px] font-[550] text-[var(--accent)] hover:underline"
                >
                  Saisir CA
                </Link>
              </div>
              <div className="mt-3 h-[6px] w-full overflow-hidden rounded-[3px] bg-[var(--bg-subtle)]">
                <div
                  className={[
                    "h-full rounded-[3px] transition-[width]",
                    progrJour >= 100 ? "bg-[var(--success)]" : progrJour >= 70 ? "bg-[var(--accent)]" : "bg-[var(--warning)]",
                  ].join(" ")}
                  style={{ width: `${progrJour}%`, transitionDuration: "300ms", transitionTimingFunction: "var(--ease-out)" }}
                />
              </div>
            </section>
          ) : null}

          {/* Row 2 : CA 7 jours + Alertes */}
          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Bar chart CA 7 jours */}
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-[14px]">
                <div>
                  <div className="text-[14px] font-semibold tracking-[-0.01em]">
                    Chiffre d&apos;affaires — 7 derniers jours
                  </div>
                  <div className="text-[12.5px] text-[var(--text-muted)]">
                    Total semaine ·{" "}
                    <span className="mono tabular font-semibold text-[var(--text)]">
                      {fmt(caWeek)}
                    </span>
                  </div>
                </div>
                <Link
                  href="/dashboard/restaurateur/gestion/saisie-ca"
                  className="text-[12px] font-[550] text-[var(--accent)] hover:underline"
                >
                  Saisir CA
                </Link>
              </div>
              <div className="px-4 pt-3 pb-5">
                <BarChart data={last7Days} />
              </div>
            </Card>

            {/* Alertes */}
            <Card>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-[14px]">
                <Icon name="sparkles" size={15} className="text-[var(--accent)]" />
                <div className="text-[14px] font-semibold tracking-[-0.01em] flex-1">
                  Alertes intelligentes
                </div>
                {alerts.length > 0 ? (
                  <Badge tone="accent">{alerts.length}</Badge>
                ) : null}
              </div>
              <div className="flex flex-col">
                {alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                      <Icon name="check-circle" size={18} />
                    </div>
                    <p className="text-[13px] font-[550] text-[var(--text)]">Tout est sous contrôle</p>
                    <p className="text-[11.5px] text-[var(--text-muted)]">Aucune alerte ce matin.</p>
                  </div>
                ) : (
                  alerts.slice(0, 4).map((a, i) => <AlertRow key={i} alert={a} />)
                )}
              </div>
            </Card>
          </section>

          {/* Row 3 : Dernières commandes + Raccourcis */}
          <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Commandes récentes */}
            <Card className="lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-[14px]">
                <div className="text-[14px] font-semibold tracking-[-0.01em] flex-1">
                  Commandes récentes
                </div>
                <Link
                  href="/dashboard/restaurateur/historique"
                  className="text-[12px] font-[550] text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                >
                  Voir tout
                  <Icon name="arrow-right" size={12} />
                </Link>
              </div>
              {derniereCommandes.length === 0 ? (
                <div className="px-4 py-6 text-[13px] text-[var(--text-muted)]">
                  Aucune commande récente.
                </div>
              ) : (
                <ul>
                  {derniereCommandes.map((c, i) => (
                    <li
                      key={c.id}
                      className={[
                        "grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3",
                        i > 0 ? "border-t border-[var(--border)]" : "",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="mono tabular text-[12.5px] font-[600] text-[var(--text)]">
                          {c.source === "import"
                            ? "Facture importée"
                            : `CMD-${c.id.slice(0, 6).toUpperCase()}`}
                        </p>
                        <p className="text-[11.5px] text-[var(--text-muted)]">
                          {new Date(c.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge tone={statusTone(c.statut)}>{statusLabel(c.statut)}</Badge>
                      <span className="mono tabular text-[13px] font-[600] text-[var(--text)] tabular-nums">
                        {fmt(Number(c.montant_total))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Raccourcis */}
            <Card>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-[14px]">
                <Icon name="zap" size={15} className="text-[var(--warning)]" />
                <div className="text-[14px] font-semibold tracking-[-0.01em]">
                  Raccourcis
                </div>
              </div>
              <div className="grid grid-cols-2">
                <Shortcut
                  href="/dashboard/restaurateur/commandes"
                  iconName="shopping-cart"
                  title="Passer commande"
                  desc="Catalogue fournisseurs"
                />
                <Shortcut
                  href="/dashboard/restaurateur/menu"
                  iconName="chef-hat"
                  title="Nouvelle fiche"
                  desc="Calcul de marge"
                  className="border-l border-[var(--border)]"
                />
                <Shortcut
                  href="/dashboard/restaurateur/factures"
                  iconName="file-text"
                  title="Saisir facture"
                  desc="Import IA"
                  className="border-t border-[var(--border)]"
                />
                <Shortcut
                  href="/dashboard/restaurateur/menu/mercuriale"
                  iconName="upload"
                  title="Mercuriale"
                  desc="PDF · Image · IA"
                  className="border-l border-t border-[var(--border)]"
                />
              </div>
            </Card>
          </section>

          {/* Info discrète si pas d'objectif */}
          {objectifCaJour === 0 ? (
            <section className="mt-4">
              <Banner tone="info">
                Définissez un objectif de CA journalier dans{" "}
                <Link href="/dashboard/restaurateur/gestion/budget" className="underline font-[550]">
                  Budget
                </Link>{" "}
                pour voir votre progression en direct.
              </Banner>
            </section>
          ) : null}
        </>
      )}
    </DashboardLayout>
  );
}

// ─── Components ──────────────────────────────────────────────────

function Sparkline({ data, color = "#6366F1", w = 70, h = 28 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`).join(" ");
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polygon points={fillPts} fill={color} opacity="0.08" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={w} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

function BarChart({ data }: { data: { day: string; ca: number; key: string }[] }) {
  const max = Math.max(1, ...data.map(d => d.ca));
  return (
    <div className="flex items-end gap-3 h-[160px] pt-3">
      {data.map((d, i) => {
        const heightPct = (d.ca / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={d.key} className="flex-1 flex flex-col items-center gap-[6px]">
            <div className="mono tabular text-[10px] font-semibold text-[var(--text-muted)]">
              {d.ca > 0 ? `${(d.ca / 1000).toFixed(1)}k` : "—"}
            </div>
            <div className="w-full h-[110px] flex items-end relative">
              <div
                className="w-full rounded-t-[6px] rounded-b-[2px] transition-[height] duration-[400ms] ease-out"
                style={{
                  height: `${heightPct}%`,
                  background: isToday
                    ? "linear-gradient(180deg, #6366F1 0%, #818CF8 100%)"
                    : "linear-gradient(180deg, #E0E7FF 0%, #EEF2FF 100%)",
                  boxShadow: isToday ? "0 2px 6px rgba(99,102,241,0.25)" : undefined,
                }}
              />
            </div>
            <div
              className={[
                "text-[11.5px]",
                isToday ? "text-[var(--accent)] font-semibold" : "text-[var(--text-muted)] font-medium",
              ].join(" ")}
            >
              {d.day}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertRow({ alert }: { alert: { kind: "danger" | "warning" | "info" | "success"; title: string; desc: string; href?: string } }) {
  const iconMap = {
    danger: "alert-circle",
    warning: "alert-triangle",
    info: "info",
    success: "check-circle",
  } as const;
  const chip =
    alert.kind === "danger"
      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
      : alert.kind === "warning"
        ? "bg-[var(--warning-soft)] text-[#B45309]"
        : alert.kind === "success"
          ? "bg-[var(--success-soft)] text-[var(--success)]"
          : "bg-[var(--info-soft)] text-[#0369A1]";
  const content = (
    <div className="flex items-start gap-[10px] px-4 py-[10px] border-t border-[var(--border)] first:border-t-0 hover:bg-[var(--bg-subtle)] transition-colors">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${chip}`}>
        <Icon name={iconMap[alert.kind]} size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-[550] text-[var(--text)]">{alert.title}</p>
        <p className="text-[11.5px] text-[var(--text-muted)] truncate">{alert.desc}</p>
      </div>
    </div>
  );
  return alert.href ? <Link href={alert.href}>{content}</Link> : content;
}

function Shortcut({
  href,
  iconName,
  title,
  desc,
  className = "",
}: {
  href: string;
  iconName: IconName;
  title: string;
  desc: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex flex-col gap-[6px] bg-white px-4 py-[14px]",
        "transition-colors duration-[120ms] hover:bg-[var(--bg-subtle)]",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Icon name={iconName} size={14} />
        </div>
        <div className="text-[13px] font-semibold text-[var(--text)]">{title}</div>
      </div>
      <div className="ml-9 text-[11.5px] text-[var(--text-muted)]">{desc}</div>
    </Link>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function statusTone(statut: string): "neutral" | "success" | "warning" | "danger" | "info" | "accent" {
  switch (statut) {
    case "recue":
    case "receptionnee":
    case "livree":
      return "success";
    case "en_cours":
    case "expediee":
    case "preparation":
      return "warning";
    case "confirmee":
      return "accent";
    case "envoyee":
    case "en_attente":
      return "info";
    case "annulee":
    case "refusee":
      return "danger";
    default:
      return "neutral";
  }
}

function statusLabel(statut: string): string {
  const map: Record<string, string> = {
    envoyee: "Envoyée",
    confirmee: "Confirmée",
    preparation: "Préparation",
    expediee: "Expédiée",
    livree: "Livrée",
    receptionnee: "Réceptionnée",
    recue: "Réceptionnée",
    en_cours: "En cours",
    en_attente: "En attente",
    annulee: "Annulée",
    refusee: "Refusée",
    brouillon: "Brouillon",
  };
  return map[statut] || statut;
}
