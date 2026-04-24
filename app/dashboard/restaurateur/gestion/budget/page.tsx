"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { loadRestaurateurData, montantNet, fmt, CAT_LABELS, CAT_COLORS, type Commande } from "@/lib/gestion-data";
import { useProfile } from "@/lib/auth/use-profile";
import {
  generateRapportMensuel, generateRapportAnnuel,
  generateRapportFournisseurs, generateRapportProduits,
} from "@/lib/rapport-pdf";

type ModeSaisie = "journalier" | "mensuel";

interface TRLigne   { emetteur: string; nb: number; valeur: number; total: number }
interface AutreLig  { mode: string; montant: number; reference: string }
interface EspDet    { "50": number; "20": number; "10": number; "5": number; pieces: number }

interface CaRow {
  id:              string;
  date:            string;
  mode_saisie:     ModeSaisie;
  especes_detail:  EspDet;
  especes_total:   number;
  cb_montant:      number;
  cb_reference:    string | null;
  tr_detail:       TRLigne[];
  tr_total:        number;
  autres_detail:   AutreLig[];
  autres_total:    number;
  ca_total:        number;
  notes:           string | null;
  saisi_par:       string | null;
}

const OBJECTIF_KEY = "restopilot_budget_config";

// ── Filtre période ─────────────────────────────────────────────────────
type PeriodPreset = "semaine" | "mois" | "3mois" | "6mois" | "annee" | "custom";

const PRESETS: { id: Exclude<PeriodPreset, "custom">; label: string }[] = [
  { id: "semaine", label: "Cette semaine" },
  { id: "mois",    label: "Ce mois" },
  { id: "3mois",   label: "3 mois" },
  { id: "6mois",   label: "6 mois" },
  { id: "annee",   label: "Cette année" },
];

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(preset: Exclude<PeriodPreset, "custom">): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  let from: string;
  if (preset === "semaine") {
    const d = new Date(today); d.setDate(today.getDate() - 6); from = isoDay(d);
  } else if (preset === "mois") {
    from = isoDay(new Date(today.getFullYear(), today.getMonth(), 1));
  } else if (preset === "3mois") {
    const d = new Date(today); d.setMonth(today.getMonth() - 3); d.setDate(d.getDate() + 1); from = isoDay(d);
  } else if (preset === "6mois") {
    const d = new Date(today); d.setMonth(today.getMonth() - 6); d.setDate(d.getDate() + 1); from = isoDay(d);
  } else {
    from = isoDay(new Date(today.getFullYear(), 0, 1));
  }
  return { from, to };
}

function formatPeriodLabel(preset: PeriodPreset, from: string, to: string): string {
  const fd = new Date(from + "T00:00:00");
  const td = new Date(to + "T00:00:00");
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (preset === "annee") return `Année ${fd.getFullYear()}`;
  if (preset === "mois") {
    return cap(fd.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  }
  return `${fd.toLocaleDateString("fr-FR")} au ${td.toLocaleDateString("fr-FR")}`;
}

export default function BudgetPage() {
  const { profile } = useProfile();
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [caRows, setCaRows]         = useState<CaRow[]>([]);
  const [saisisParNames, setSaisisParNames] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);

  // Config objectif (localStorage)
  const [objectifPct, setObj] = useState(28);

  const [toast, setToast]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Rapports
  const [rapportMois, setRapportMois] = useState(new Date().toISOString().slice(0, 7));
  const [rapportAnnee, setRapportAnnee] = useState(new Date().getFullYear());
  const [rapportFrom, setRFrom] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [rapportTo,   setRTo]   = useState<string>(new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState<string | null>(null);

  // Filtre période (dashboard)
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("annee");
  const [periodFrom, setPeriodFrom] = useState<string>(() => presetRange("annee").from);
  const [periodTo,   setPeriodTo]   = useState<string>(() => presetRange("annee").to);

  function applyPreset(p: Exclude<PeriodPreset, "custom">) {
    const { from, to } = presetRange(p);
    setPeriodPreset(p);
    setPeriodFrom(from);
    setPeriodTo(to);
  }

  // ── Chargement ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const d = await loadRestaurateurData();
    setCommandes(d.commandes);
    setCategories(d.categories);
    setFournNames(d.fournNames);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("ca_journalier")
        .select("*")
        .eq("restaurateur_id", user.id)
        .order("date", { ascending: false });
      const rows = (data ?? []) as CaRow[];
      setCaRows(rows);

      // Charge le nom des employés pour la colonne "Saisi par"
      const authorIds = Array.from(new Set(
        rows.map(r => r.saisi_par).filter((v): v is string => !!v && v !== user.id),
      ));
      if (authorIds.length > 0) {
        const { data: auths } = await supabase
          .from("profiles")
          .select("id, prenom, nom")
          .in("id", authorIds);
        const map: Record<string, string> = {};
        (auths ?? []).forEach((a: { id: string; prenom: string | null; nom: string | null }) => {
          map[a.id] = [a.prenom, a.nom].filter(Boolean).join(" ").trim() || "Employé";
        });
        setSaisisParNames(map);
      } else {
        setSaisisParNames({});
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OBJECTIF_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.objectifPct === "number") setObj(p.objectifPct);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(OBJECTIF_KEY, JSON.stringify({ objectifPct })); } catch {}
  }, [objectifPct]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // CA par mois depuis ca_journalier
  const caParMois = useMemo(() => {
    const map = new Map<string, number>();
    caRows.forEach(r => {
      const k = r.date.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + Number(r.ca_total ?? 0));
    });
    return map;
  }, [caRows]);

  // ── Données filtrées par période ──
  const filteredCaRows = useMemo(
    () => caRows.filter(r => r.date >= periodFrom && r.date <= periodTo),
    [caRows, periodFrom, periodTo],
  );
  const filteredCommandes = useMemo(
    () => commandes.filter(c => {
      if (c.statut === "annulee") return false;
      const d = c.created_at.slice(0, 10);
      return d >= periodFrom && d <= periodTo;
    }),
    [commandes, periodFrom, periodTo],
  );

  // Buckets (jour si ≤ 31 jours, sinon mois)
  const chartData = useMemo(() => {
    const f = new Date(periodFrom + "T00:00:00");
    const t = new Date(periodTo   + "T00:00:00");
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || t < f) return [];
    const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
    const granularity: "day" | "month" = days <= 31 ? "day" : "month";

    type Bucket = { key: string; label: string; ca: number; depenses: number };
    const buckets: Bucket[] = [];

    if (granularity === "day") {
      const d = new Date(f);
      while (d <= t) {
        buckets.push({
          key: isoDay(d),
          label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
          ca: 0, depenses: 0,
        });
        d.setDate(d.getDate() + 1);
      }
    } else {
      const m = new Date(f.getFullYear(), f.getMonth(), 1);
      const endM = new Date(t.getFullYear(), t.getMonth(), 1);
      while (m <= endM) {
        const k = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
        buckets.push({
          key: k,
          label: m.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
          ca: 0, depenses: 0,
        });
        m.setMonth(m.getMonth() + 1);
      }
    }

    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    const sliceKey = (s: string) => granularity === "day" ? s.slice(0, 10) : s.slice(0, 7);

    filteredCaRows.forEach(r => {
      const i = idx.get(sliceKey(r.date));
      if (i !== undefined) buckets[i].ca += Number(r.ca_total ?? 0);
    });
    filteredCommandes.forEach(c => {
      const i = idx.get(sliceKey(c.created_at));
      if (i !== undefined) buckets[i].depenses += montantNet(c);
    });

    return buckets.map(b => ({
      ...b,
      ca:       Math.round(b.ca       * 100) / 100,
      depenses: Math.round(b.depenses * 100) / 100,
      marge:    Math.round((b.ca - b.depenses) * 100) / 100,
      coutPct:  b.ca > 0 ? Math.round((b.depenses / b.ca) * 100) : 0,
    }));
  }, [filteredCaRows, filteredCommandes, periodFrom, periodTo]);

  // Catégories sur la période
  const parCategorie = useMemo(() => {
    const map = new Map<string, number>();
    filteredCommandes.forEach(c => {
      c.lignes_commande.forEach(l => {
        const cat = categories[l.nom_snapshot] ?? "epicerie";
        map.set(cat, (map.get(cat) ?? 0) + Number(l.prix_snapshot) * Number(l.quantite));
      });
    });
    return Array.from(map.entries())
      .map(([cat, v]) => ({ cat, label: CAT_LABELS[cat] ?? cat, value: Math.round(v * 100) / 100, color: CAT_COLORS[cat] ?? "#6366F1" }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCommandes, categories]);

  // KPIs période
  const caPeriod     = filteredCaRows.reduce((s, r) => s + Number(r.ca_total ?? 0), 0);
  const depPeriod    = filteredCommandes.reduce((s, c) => s + montantNet(c), 0);
  const margePeriod  = caPeriod - depPeriod;
  const coutMatPeriodPct = caPeriod > 0 ? (depPeriod / caPeriod) * 100 : 0;

  // Mois courant (pour alertes / objectif — reste figé au mois en cours)
  const moisCourant      = new Date().toISOString().slice(0, 7);
  const caMoisCourant    = caParMois.get(moisCourant) ?? 0;
  const depMoisCourant   = commandes.filter(c => c.created_at.startsWith(moisCourant) && c.statut !== "annulee")
                                    .reduce((s, c) => s + montantNet(c), 0);
  const coutMatierePct   = caMoisCourant > 0 ? (depMoisCourant / caMoisCourant) * 100 : 0;

  // ── Alertes ──
  const alertes: { type: "rose" | "amber"; msg: string }[] = useMemo(() => {
    const out: { type: "rose" | "amber"; msg: string }[] = [];
    if (caMoisCourant > 0 && coutMatierePct > objectifPct) {
      out.push({ type: "rose", msg: `Coût matière ce mois-ci (${coutMatierePct.toFixed(1)}%) dépasse votre objectif (${objectifPct}%).` });
    }
    // CA YoY
    const moisAnneePrec = new Date(); moisAnneePrec.setFullYear(moisAnneePrec.getFullYear() - 1);
    const keyPrec = moisAnneePrec.toISOString().slice(0, 7);
    const caPrec = caParMois.get(keyPrec) ?? 0;
    if (caPrec > 0 && caMoisCourant > 0 && caMoisCourant < caPrec * 0.9) {
      out.push({ type: "amber", msg: `CA de ${moisCourant} en baisse de ${((1 - caMoisCourant / caPrec) * 100).toFixed(1)}% vs ${keyPrec}.` });
    }
    // Dépassement budget
    const budgetCible = (objectifPct / 100) * caMoisCourant;
    if (budgetCible > 0 && depMoisCourant > budgetCible) {
      out.push({ type: "rose", msg: `Dépenses (${fmt(depMoisCourant)}) dépassent votre budget cible (${fmt(budgetCible)}).` });
    }
    return out;
  }, [coutMatierePct, objectifPct, caMoisCourant, caParMois, moisCourant, depMoisCourant]);

  async function deleteRow(id: string) {
    if (!confirm("Supprimer cette saisie ?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("ca_journalier").delete().eq("id", id);
    if (error) {
      setToast({ type: "error", msg: error.message });
      return;
    }
    setToast({ type: "success", msg: "Saisie supprimée." });
    fetchAll();
  }

  // ── Rapports ──
  async function exportRapport(type: "mensuel" | "annuel" | "fournisseurs" | "produits") {
    if (!profile) return;
    setGenerating(type);
    try {
      if (type === "mensuel") {
        const caMois = caRows.filter(r => r.date.startsWith(rapportMois));
        await generateRapportMensuel(rapportMois, commandes, caMois, categories, fournNames, profile);
      } else if (type === "annuel") {
        const caAnn = caRows.filter(r => r.date.startsWith(String(rapportAnnee)));
        await generateRapportAnnuel(rapportAnnee, commandes, caAnn, profile);
      } else if (type === "fournisseurs") {
        await generateRapportFournisseurs(new Date(rapportFrom), new Date(rapportTo + "T23:59:59"), commandes, fournNames, profile);
      } else if (type === "produits") {
        await generateRapportProduits(new Date(rapportFrom), new Date(rapportTo + "T23:59:59"), commandes, profile);
      }
      setToast({ type: "success", msg: "PDF généré." });
    } catch (e) {
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Erreur PDF" });
    }
    setGenerating(null);
  }

  const inputCls = "min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[18px] font-[650] tracking-[-0.01em] text-[var(--text)]">Budget &amp; coûts matières</h2>

      {/* ── FILTRE PÉRIODE ─────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Période analysée</h3>
          <p className="text-xs text-gray-500">
            {formatPeriodLabel(periodPreset, periodFrom, periodTo)}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                periodPreset === p.id
                  ? "bg-indigo-500 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-500">Du</span>
            <input
              type="date" value={periodFrom}
              max={periodTo}
              onChange={e => { setPeriodFrom(e.target.value); setPeriodPreset("custom"); }}
              className={inputCls + " w-40"}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-gray-500">Au</span>
            <input
              type="date" value={periodTo}
              min={periodFrom}
              onChange={e => { setPeriodTo(e.target.value); setPeriodPreset("custom"); }}
              className={inputCls + " w-40"}
            />
          </label>
          {periodPreset === "custom" && (
            <span className="self-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
              Personnalisé
            </span>
          )}
        </div>
      </section>

      {/* ── ALERTES ───────────────────────────── */}
      {alertes.length > 0 && (
        <div className="flex flex-col gap-2">
          {alertes.map((a, i) => (
            <div key={i} className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              a.type === "rose"   ? "border-rose-200 bg-rose-50 text-rose-800"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
            }`}>
              ⚠ {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* ── OBJECTIF ───────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1A1A2E]">Objectif coût matière</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Objectif (% du CA)</span>
            <input type="number" min="0" max="100" step="0.5" value={objectifPct}
                   onChange={e => setObj(parseFloat(e.target.value) || 0)}
                   className={inputCls + " w-32"} />
          </label>
          <p className="text-xs text-gray-500">
            Budget cible ce mois : <span className="font-semibold text-[#1A1A2E]">{fmt((objectifPct / 100) * caMoisCourant)}</span>
          </p>
        </div>
      </section>

      {/* ── HISTORIQUE DES SAISIES ───────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Historique des saisies CA</h3>
          <p className="text-xs text-gray-500">
            {filteredCaRows.length} saisie{filteredCaRows.length > 1 ? "s" : ""} · {formatPeriodLabel(periodPreset, periodFrom, periodTo)}
          </p>
        </div>
        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
        ) : filteredCaRows.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune saisie sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-left">Saisi par</th>
                  <th className="px-3 py-2 text-right">Espèces</th>
                  <th className="px-3 py-2 text-right">CB</th>
                  <th className="px-3 py-2 text-right">TR</th>
                  <th className="px-3 py-2 text-right">Autres</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCaRows.slice(0, 60).map(r => {
                  const saisiLabel = !r.saisi_par
                    ? "—"
                    : r.saisi_par === profile?.id
                      ? "Vous"
                      : saisisParNames[r.saisi_par] ?? "Employé";
                  return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-[#1A1A2E]">
                      {r.mode_saisie === "mensuel"
                        ? r.date.slice(0, 7)
                        : new Date(r.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.mode_saisie === "mensuel" ? "Mensuel" : "Journalier"}</td>
                    <td className="px-3 py-2 text-gray-600">{saisiLabel}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.mode_saisie === "mensuel" ? "—" : fmt(Number(r.especes_total ?? 0))}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.mode_saisie === "mensuel" ? "—" : fmt(Number(r.cb_montant ?? 0))}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.mode_saisie === "mensuel" ? "—" : fmt(Number(r.tr_total ?? 0))}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.mode_saisie === "mensuel" ? "—" : fmt(Number(r.autres_total ?? 0))}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#1A1A2E]">{fmt(Number(r.ca_total ?? 0))}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/dashboard/restaurateur/gestion/saisie-ca?edit=${r.id}`}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs hover:border-indigo-300"
                        >
                          Modifier
                        </Link>
                        <button onClick={() => deleteRow(r.id)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Suppr.</button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── DASHBOARD HISTORIQUE ─────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-[#1A1A2E]">
          Tableau de bord — {formatPeriodLabel(periodPreset, periodFrom, periodTo)}
        </h3>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="CA total"     value={fmt(caPeriod)} />
          <Kpi label="Dépenses"     value={fmt(depPeriod)} />
          <Kpi label="Marge brute"  value={fmt(margePeriod)} accent={margePeriod >= 0 ? "emerald" : "rose"} />
          <Kpi label="Coût matière" value={`${coutMatPeriodPct.toFixed(1)}%`} accent={coutMatPeriodPct > objectifPct ? "rose" : "emerald"} sub={`objectif ${objectifPct}%`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">CA vs Dépenses</p>
            <div style={{ width: "100%", height: 240 }}>
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">Aucune donnée sur la période.</div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ca"       name="CA"       fill="#6366F1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="depenses" name="Dépenses" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">Évolution marge brute</p>
            <div style={{ width: "100%", height: 240 }}>
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">Aucune donnée sur la période.</div>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                    <Line type="monotone" dataKey="marge" name="Marge" stroke="#6366F1" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-600">Répartition dépenses par catégorie</p>
          <div style={{ width: "100%", height: 240 }}>
            {parCategorie.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">Aucune dépense sur la période.</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={parCategorie} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                    {parCategorie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* ── RAPPORTS PDF ─────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Rapports exportables</h3>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Mensuel */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">📊 Rapport mensuel</p>
            <p className="mt-1 text-xs text-gray-500">CA par mode · dépenses par catégorie · comparaison M-1</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input type="month" value={rapportMois} onChange={e => setRapportMois(e.target.value)} className={inputCls} />
              <button onClick={() => exportRapport("mensuel")} disabled={generating !== null}
                      className="min-h-[40px] rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
                {generating === "mensuel" ? "…" : "↓ Générer"}
              </button>
            </div>
          </div>

          {/* Annuel */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">📅 Rapport annuel</p>
            <p className="mt-1 text-xs text-gray-500">Synthèse 12 mois · meilleur/pire mois · tendances</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input type="number" value={rapportAnnee} onChange={e => setRapportAnnee(parseInt(e.target.value) || new Date().getFullYear())}
                     className={inputCls + " w-24"} />
              <button onClick={() => exportRapport("annuel")} disabled={generating !== null}
                      className="min-h-[40px] rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
                {generating === "annuel" ? "…" : "↓ Générer"}
              </button>
            </div>
          </div>

          {/* Fournisseurs */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">🏷️ Rapport fournisseurs</p>
            <p className="mt-1 text-xs text-gray-500">Dépenses par fournisseur sur la période</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input type="date" value={rapportFrom} onChange={e => setRFrom(e.target.value)} className={inputCls + " w-36"} />
              <input type="date" value={rapportTo}   onChange={e => setRTo(e.target.value)}   className={inputCls + " w-36"} />
              <button onClick={() => exportRapport("fournisseurs")} disabled={generating !== null}
                      className="min-h-[40px] rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
                {generating === "fournisseurs" ? "…" : "↓ Générer"}
              </button>
            </div>
          </div>

          {/* Produits */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">📦 Rapport produits</p>
            <p className="mt-1 text-xs text-gray-500">Top produits achetés · prix min/max/moyen</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input type="date" value={rapportFrom} onChange={e => setRFrom(e.target.value)} className={inputCls + " w-36"} />
              <input type="date" value={rapportTo}   onChange={e => setRTo(e.target.value)}   className={inputCls + " w-36"} />
              <button onClick={() => exportRapport("produits")} disabled={generating !== null}
                      className="min-h-[40px] rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50">
                {generating === "produits" ? "…" : "↓ Générer"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-2xl border px-4 py-3 shadow-2xl ${
          toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}
    </div>
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
    <div className={`rounded-[12px] border ${border} bg-white p-3`}>
      <p className="label-upper">{label}</p>
      <p className={`mono mt-1.5 text-[20px] font-[650] tracking-[-0.02em] leading-[1.1] ${txt}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[var(--text-subtle)]">{sub}</p>}
    </div>
  );
}
