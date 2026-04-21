"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { loadRestaurateurData, montantNet, fmt, type Commande } from "@/lib/gestion-data";
import { useProfile } from "@/lib/auth/use-profile";

// ── Types ───────────────────────────────────────────────────────────

type TabKey = "dashboard" | "releve" | "charges" | "salaires" | "exceptionnelles" | "pointage";

type PointeType = "facture" | "charge_paiement" | "salaire" | "solde_tout_compte" | "depense_exceptionnelle" | "manuel";

interface ReleveBancaire {
  id: string; periode_debut: string; periode_fin: string;
  solde_debut: number; solde_fin: number; source: string; fichier_nom: string | null; notes: string | null;
}
interface ReleveLigne {
  id: string; releve_id: string; date_op: string; libelle: string;
  debit: number; credit: number; solde: number | null;
  pointe_type: PointeType | null; pointe_id: string | null; pointe_note: string | null;
  anomalie: boolean;
}
interface ChargeRecurrente {
  id: string; nom: string; categorie: string; montant: number;
  frequence: "mensuel" | "trimestriel" | "annuel"; jour_prelevement: number | null; actif: boolean; notes: string | null;
}
interface ChargePaiement {
  id: string; charge_id: string; date_prelevement: string; montant: number;
  reference: string | null; releve_ligne_id: string | null; notes: string | null;
}
interface EmployeFiche {
  id: string; prenom: string; nom: string; poste: string | null;
  type_contrat: "CDI" | "CDD" | "Extra" | "Apprentissage" | "Stage" | null;
  date_embauche: string | null; date_sortie: string | null; actif: boolean;
}
interface Salaire {
  id: string; employe_fiche_id: string; mois: string;
  salaire_brut: number; salaire_net: number;
  mode_paiement: "virement" | "especes" | "cheque" | null;
  virement_reference: string | null;
  especes_detail: Record<string, number>;
  urssaf_montant: number; urssaf_reference: string | null;
  prevoyance_montant: number; prevoyance_nom: string | null; prevoyance_reference: string | null;
  autres_cotisations: { nom: string; montant: number; reference?: string }[];
  releve_ligne_id: string | null; notes: string | null;
}
interface DepenseExceptionnelle {
  id: string; date_dep: string; description: string; montant: number;
  categorie: string | null; justificatif_url: string | null; releve_ligne_id: string | null; notes: string | null;
}
interface SoldeToutCompte {
  id: string; employe_fiche_id: string; date_sortie: string; montant: number;
  motif: string | null; mode_paiement: string | null; reference: string | null;
  releve_ligne_id: string | null; notes: string | null;
}

const CATEG_CHARGES = [
  { id: "loyer",        label: "Loyer" },
  { id: "electricite",  label: "Électricité" },
  { id: "gaz",          label: "Gaz" },
  { id: "eau",          label: "Eau" },
  { id: "assurance",    label: "Assurance" },
  { id: "telephone",    label: "Téléphone" },
  { id: "internet",     label: "Internet" },
  { id: "abonnement",   label: "Abonnement" },
  { id: "autre",        label: "Autre" },
];
const CATEG_EXCEPT = [
  { id: "reparation", label: "Réparation" },
  { id: "equipement", label: "Équipement" },
  { id: "formation",  label: "Formation" },
  { id: "mobilier",   label: "Mobilier" },
  { id: "deco",       label: "Décoration" },
  { id: "autre",      label: "Autre" },
];

const inputCls = "min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

// ── Page principale ─────────────────────────────────────────────────

export default function TresoreriePage() {
  const { profile } = useProfile();
  const supa = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<TabKey>("dashboard");

  // Data
  const [commandes, setCommandes]       = useState<Commande[]>([]);
  const [releves, setReleves]           = useState<ReleveBancaire[]>([]);
  const [releveLignes, setReleveLignes] = useState<ReleveLigne[]>([]);
  const [charges, setCharges]           = useState<ChargeRecurrente[]>([]);
  const [chargePaiements, setChargeP]   = useState<ChargePaiement[]>([]);
  const [fiches, setFiches]             = useState<EmployeFiche[]>([]);
  const [salaires, setSalaires]         = useState<Salaire[]>([]);
  const [stcs, setStcs]                 = useState<SoldeToutCompte[]>([]);
  const [exceps, setExceps]             = useState<DepenseExceptionnelle[]>([]);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const uid = profile.id;

    const [dataGestion, r, rl, c, cp, f, s, stc, e] = await Promise.all([
      loadRestaurateurData(),
      supa.from("releves_bancaires").select("*").eq("restaurateur_id", uid).order("periode_debut", { ascending: false }),
      supa.from("releve_lignes").select("*").eq("restaurateur_id", uid).order("date_op", { ascending: false }),
      supa.from("charges_recurrentes").select("*").eq("restaurateur_id", uid).order("nom"),
      supa.from("charges_paiements").select("*").eq("restaurateur_id", uid).order("date_prelevement", { ascending: false }),
      supa.from("employes_fiches").select("*").eq("restaurateur_id", uid).order("nom"),
      supa.from("salaires_mensuels").select("*").eq("restaurateur_id", uid).order("mois", { ascending: false }),
      supa.from("soldes_tout_compte").select("*").eq("restaurateur_id", uid).order("date_sortie", { ascending: false }),
      supa.from("depenses_exceptionnelles").select("*").eq("restaurateur_id", uid).order("date_dep", { ascending: false }),
    ]);

    setCommandes(dataGestion.commandes);
    setReleves((r.data ?? []) as ReleveBancaire[]);
    setReleveLignes((rl.data ?? []) as ReleveLigne[]);
    setCharges((c.data ?? []) as ChargeRecurrente[]);
    setChargeP((cp.data ?? []) as ChargePaiement[]);
    setFiches((f.data ?? []) as EmployeFiche[]);
    setSalaires((s.data ?? []) as Salaire[]);
    setStcs((stc.data ?? []) as SoldeToutCompte[]);
    setExceps((e.data ?? []) as DepenseExceptionnelle[]);
    setLoading(false);
  }, [supa, profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const ctx = {
    profile, supa, commandes, releves, releveLignes, charges, chargePaiements,
    fiches, salaires, stcs, exceps, loading,
    reload: fetchAll,
    notify: (type: "success" | "error", msg: string) => setToast({ type, msg }),
  };

  const tabs: { id: TabKey; label: string; icon: string }[] = [
    { id: "dashboard",       label: "Tableau de bord", icon: "📊" },
    { id: "releve",          label: "Relevé",          icon: "🏦" },
    { id: "charges",         label: "Charges fixes",   icon: "📑" },
    { id: "salaires",        label: "Masse salariale", icon: "👥" },
    { id: "exceptionnelles", label: "Exceptionnelles", icon: "⚡" },
    { id: "pointage",        label: "Pointage",        icon: "✅" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-[#1A1A2E]">Trésorerie</h2>

      {/* Sous-onglets */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
        {tabs.map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-indigo-500 text-white" : "text-gray-500 hover:text-[#1A1A2E]"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      ) : (
        <>
          {tab === "dashboard"       && <DashboardTab ctx={ctx} />}
          {tab === "releve"          && <ReleveTab ctx={ctx} />}
          {tab === "charges"         && <ChargesTab ctx={ctx} />}
          {tab === "salaires"        && <SalairesTab ctx={ctx} />}
          {tab === "exceptionnelles" && <ExceptionnellesTab ctx={ctx} />}
          {tab === "pointage"        && <PointageTab ctx={ctx} />}
        </>
      )}

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

// ── Contexte partagé ────────────────────────────────────────────────

type Ctx = {
  profile: ReturnType<typeof useProfile>["profile"];
  supa: ReturnType<typeof createClient>;
  commandes: Commande[];
  releves: ReleveBancaire[];
  releveLignes: ReleveLigne[];
  charges: ChargeRecurrente[];
  chargePaiements: ChargePaiement[];
  fiches: EmployeFiche[];
  salaires: Salaire[];
  stcs: SoldeToutCompte[];
  exceps: DepenseExceptionnelle[];
  loading: boolean;
  reload: () => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
};

// ── Dashboard ───────────────────────────────────────────────────────

function DashboardTab({ ctx }: { ctx: Ctx }) {
  const { releves, releveLignes, charges, commandes, salaires, exceps } = ctx;

  // Solde actuel = solde_fin du relevé le plus récent
  const soldeActuel = releves[0]?.solde_fin ?? 0;
  const dernierReleve = releves[0];

  // Prévision 30 jours : charges récurrentes mensuelles × prorata + trimestrielles/annuelles échues
  const previ30j = useMemo(() => {
    let total = 0;
    const today = new Date();
    charges.filter(c => c.actif).forEach(c => {
      if (c.frequence === "mensuel") total += Number(c.montant);
      else if (c.frequence === "trimestriel") total += Number(c.montant) / 3;
      else if (c.frequence === "annuel") total += Number(c.montant) / 12;
    });
    return total;
  }, [charges, /* eslint-disable-line react-hooks/exhaustive-deps */]);

  // Entrées/Sorties par semaine (8 dernières semaines) — lignes relevé
  const hebdo = useMemo(() => {
    const now = new Date();
    const weeks: { key: string; label: string; credit: number; debit: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i * 7);
      const start = new Date(d); start.setDate(d.getDate() - d.getDay());
      const key = start.toISOString().slice(0, 10);
      weeks.push({ key, label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), credit: 0, debit: 0 });
    }
    const idxByKey = new Map(weeks.map((w, i) => [w.key, i]));
    releveLignes.forEach(l => {
      const d = new Date(l.date_op + "T00:00:00");
      const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
      const k = ws.toISOString().slice(0, 10);
      const i = idxByKey.get(k);
      if (i !== undefined) {
        weeks[i].credit += Number(l.credit);
        weeks[i].debit  += Number(l.debit);
      }
    });
    return weeks;
  }, [releveLignes]);

  // Répartition dépenses (mois courant)
  const moisKey = new Date().toISOString().slice(0, 7);
  const repartition = useMemo(() => {
    const matieres = commandes.filter(c => c.created_at.startsWith(moisKey) && c.statut !== "annulee")
      .reduce((s, c) => s + montantNet(c), 0);
    const salairesM = salaires.filter(s => s.mois.startsWith(moisKey))
      .reduce((s, x) => s + Number(x.salaire_net) + Number(x.urssaf_montant) + Number(x.prevoyance_montant), 0);
    const chargesF  = ctx.chargePaiements.filter(p => p.date_prelevement.startsWith(moisKey))
      .reduce((s, p) => s + Number(p.montant), 0);
    const exceptM   = exceps.filter(e => e.date_dep.startsWith(moisKey))
      .reduce((s, e) => s + Number(e.montant), 0);
    return [
      { name: "Matières",       value: Math.round(matieres * 100) / 100, color: "#EF4444" },
      { name: "Salaires",       value: Math.round(salairesM * 100) / 100, color: "#6366F1" },
      { name: "Charges fixes",  value: Math.round(chargesF * 100) / 100, color: "#F59E0B" },
      { name: "Exceptionnel",   value: Math.round(exceptM * 100) / 100, color: "#10B981" },
    ].filter(x => x.value > 0);
  }, [commandes, salaires, ctx.chargePaiements, exceps, moisKey]);

  // CA mois courant + taux charges sociales
  // (on relit ca_journalier pour rester cohérent)
  const [caMois, setCaMois] = useState(0);
  useEffect(() => {
    (async () => {
      const { data } = await ctx.supa.from("ca_journalier")
        .select("ca_total, date")
        .gte("date", moisKey + "-01")
        .lte("date", moisKey + "-31");
      setCaMois((data ?? []).reduce((s, r: { ca_total: number }) => s + Number(r.ca_total), 0));
    })();
  }, [ctx.supa, moisKey]);

  const chargesSocialesMois = salaires.filter(s => s.mois.startsWith(moisKey))
    .reduce((s, x) => s + Number(x.urssaf_montant) + Number(x.prevoyance_montant), 0);
  const tauxChargesSoc = caMois > 0 ? (chargesSocialesMois / caMois) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Solde bancaire" value={fmt(soldeActuel)} sub={dernierReleve ? `au ${new Date(dernierReleve.periode_fin).toLocaleDateString("fr-FR")}` : "aucun relevé"} />
        <Kpi label="Prévu 30 j"      value={fmt(-previ30j)} sub="charges récurrentes" accent="rose" />
        <Kpi label="Charges sociales" value={`${tauxChargesSoc.toFixed(1)}%`} sub={`du CA ${moisKey}`} />
        <Kpi label="Dépenses except." value={fmt(repartition.find(r => r.name === "Exceptionnel")?.value ?? 0)} sub={moisKey} />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-medium text-gray-600">Entrées / Sorties (8 semaines)</p>
        <div style={{ width: "100%", height: 240 }}>
          {releveLignes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">Importez un relevé pour voir les mouvements.</div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={hebdo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
                <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="credit" name="Entrées" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="debit"  name="Sorties" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-medium text-gray-600">Répartition dépenses — mois {moisKey}</p>
        <div style={{ width: "100%", height: 240 }}>
          {repartition.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">Aucune dépense enregistrée ce mois-ci.</div>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={repartition} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                  {repartition.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => fmt(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Relevé ──────────────────────────────────────────────────────────

function ReleveTab({ ctx }: { ctx: Ctx }) {
  const [selectedReleveId, setSelectedReleveId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const currentReleveId = selectedReleveId ?? ctx.releves[0]?.id ?? null;
  const currentReleve = ctx.releves.find(r => r.id === currentReleveId);
  const lignes = ctx.releveLignes.filter(l => l.releve_id === currentReleveId);

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const { data: { user } } = await ctx.supa.auth.getUser();
      if (!user) throw new Error("Session expirée");

      type LigneImportee = {
        date:            string | null;
        libelle:         string;
        montant_debit:   number;
        montant_credit:  number;
        solde_courant:   number | null;
      };
      let parsed: {
        periode_debut: string | null; periode_fin: string | null;
        solde_debut:   number | null; solde_fin:   number | null;
        lignes:        LigneImportee[];
      };

      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        parsed = parseCsv(text);
      } else {
        // PDF via Claude — encodage base64 via FileReader pour éviter le stack
        // overflow de btoa(String.fromCharCode(...large array)).
        const base64 = await fileToBase64(file);
        let res: Response;
        try {
          res = await fetch("/api/releve-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileBase64: base64 }),
          });
        } catch (netErr) {
          throw new Error("Connexion au serveur impossible : " + (netErr instanceof Error ? netErr.message : String(netErr)));
        }
        // Le serveur garantit du JSON, mais on se protège quand même contre
        // une page HTML renvoyée par Netlify (413, 504 gateway…).
        const raw = await res.text();
        let json: { ok?: boolean; releve?: typeof parsed; error?: string };
        try {
          json = JSON.parse(raw);
        } catch {
          const snippet = raw.replace(/<[^>]+>/g, "").trim().slice(0, 200);
          throw new Error(`Le serveur a renvoyé une réponse invalide (${res.status}). ${snippet || "Réessayez ou vérifiez les logs."}`);
        }
        if (!res.ok || !json.releve) {
          throw new Error(json.error ?? `Import échoué (HTTP ${res.status}).`);
        }
        parsed = json.releve;
      }

      // Créer l'en-tête de relevé
      const datesISO = parsed.lignes.map(l => l.date).filter(Boolean) as string[];
      const pdeb = parsed.periode_debut ?? (datesISO.length ? [...datesISO].sort()[0] : new Date().toISOString().slice(0, 10));
      const pfin = parsed.periode_fin   ?? (datesISO.length ? [...datesISO].sort().at(-1)! : new Date().toISOString().slice(0, 10));

      const { data: rel, error: errR } = await ctx.supa.from("releves_bancaires").insert({
        restaurateur_id: user.id,
        periode_debut:   pdeb,
        periode_fin:     pfin,
        solde_debut:     parsed.solde_debut ?? 0,
        solde_fin:       parsed.solde_fin   ?? 0,
        source:          file.name.toLowerCase().endsWith(".csv") ? "csv" : "pdf",
        fichier_nom:     file.name,
      }).select().single();
      if (errR || !rel) throw new Error(errR?.message ?? "Insertion relevé échouée");

      // Insérer les lignes
      const rows = parsed.lignes.map(l => ({
        releve_id:       rel.id,
        restaurateur_id: user.id,
        date_op:         l.date ?? pdeb,
        libelle:         l.libelle,
        debit:           l.montant_debit,
        credit:          l.montant_credit,
        solde:           l.solde_courant,
      }));
      if (rows.length > 0) {
        const { error: errL } = await ctx.supa.from("releve_lignes").insert(rows);
        if (errL) throw new Error(errL.message);
      }

      ctx.notify("success", `Relevé importé : ${rows.length} lignes.`);
      setSelectedReleveId(rel.id);
      await ctx.reload();
    } catch (e) {
      ctx.notify("error", e instanceof Error ? e.message : "Erreur import");
    }
    setImporting(false);
  }

  async function togglePointage(ligne: ReleveLigne) {
    const nextPointe = !ligne.pointe_type;
    const { error } = await ctx.supa.from("releve_lignes")
      .update({ pointe_type: nextPointe ? "manuel" : null, pointe_id: null, pointe_note: nextPointe ? "Pointé manuellement" : null })
      .eq("id", ligne.id);
    if (error) { ctx.notify("error", error.message); return; }
    await ctx.reload();
  }

  async function handleDeleteReleve() {
    if (!deleteId) return;
    const { error } = await ctx.supa.from("releves_bancaires").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) { ctx.notify("error", error.message); return; }
    ctx.notify("success", "Relevé supprimé.");
    if (selectedReleveId === deleteId) setSelectedReleveId(null);
    await ctx.reload();
  }

  // Solde rapproché (somme des lignes pointées)
  const soldePointe = lignes.filter(l => l.pointe_type).reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
  const ecart = currentReleve ? (Number(currentReleve.solde_fin) - Number(currentReleve.solde_debut) - soldePointe) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Import */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1A1A2E]">Importer un relevé</h3>
        <p className="mt-1 text-xs text-gray-500">PDF (analyse via Claude) ou CSV (libellé, débit, crédit, date).</p>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:opacity-95">
          <input type="file" accept=".pdf,.csv" hidden
                 onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); e.currentTarget.value = ""; }} />
          <span>{importing ? "Analyse en cours…" : "📎 Choisir un fichier"}</span>
        </label>
      </section>

      {/* Sélection relevé */}
      {ctx.releves.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">Relevés importés</h3>
            <select value={currentReleveId ?? ""} onChange={e => setSelectedReleveId(e.target.value)}
                    className={inputCls + " max-w-md"}>
              {ctx.releves.map(r => (
                <option key={r.id} value={r.id}>
                  {new Date(r.periode_debut).toLocaleDateString("fr-FR")} — {new Date(r.periode_fin).toLocaleDateString("fr-FR")} ({r.source})
                </option>
              ))}
            </select>
            {currentReleve && (
              <button onClick={() => setDeleteId(currentReleve.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">
                Supprimer ce relevé
              </button>
            )}
          </div>
          {currentReleve && (
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Solde initial" value={fmt(Number(currentReleve.solde_debut))} />
              <Kpi label="Solde final"   value={fmt(Number(currentReleve.solde_fin))} />
              <Kpi label="Lignes"        value={String(lignes.length)} />
              <Kpi label="Écart pointage" value={fmt(ecart)} accent={Math.abs(ecart) > 0.01 ? "rose" : "emerald"} />
            </div>
          )}
        </section>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-[#1A1A2E]">Supprimer ce relevé et toutes ses lignes ?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">Annuler</button>
              <button onClick={handleDeleteReleve} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Lignes */}
      {currentReleve && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Lignes du relevé</h3>
          {lignes.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune ligne.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Libellé</th>
                    <th className="px-3 py-2 text-right">Débit</th>
                    <th className="px-3 py-2 text-right">Crédit</th>
                    <th className="px-3 py-2 text-right">Solde</th>
                    <th className="px-3 py-2 text-center">Pointage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lignes.map(l => {
                    const statut = l.anomalie ? "anomalie" : l.pointe_type ? "pointe" : "attente";
                    const badge = statut === "pointe"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : statut === "anomalie"
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";
                    return (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-[#1A1A2E]">{new Date(l.date_op).toLocaleDateString("fr-FR")}</td>
                        <td className="px-3 py-2 text-gray-600">{l.libelle}</td>
                        <td className="px-3 py-2 text-right text-red-600">{l.debit > 0  ? fmt(Number(l.debit))  : "—"}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{l.credit > 0 ? fmt(Number(l.credit)) : "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{l.solde != null ? fmt(Number(l.solde)) : "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => togglePointage(l)}
                                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badge}`}>
                            {statut === "pointe" ? "✓ Pointé" : statut === "anomalie" ? "⚠ Anomalie" : "En attente"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// CSV parser : auto-détecte les colonnes (date, libellé, débit, crédit, solde)
function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { periode_debut: null, periode_fin: null, solde_debut: null, solde_fin: null, lignes: [] };
  // Détection séparateur
  const sep = lines[0].includes(";") ? ";" : ",";
  const rows = lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, "")));
  const header = rows[0].map(c => c.toLowerCase());
  const iDate   = header.findIndex(c => /date/.test(c));
  const iLib    = header.findIndex(c => /lib|descr|mouv|op[eé]|detail/.test(c));
  const iDeb    = header.findIndex(c => /d[eé]bit|sortie|retrait/.test(c));
  const iCred   = header.findIndex(c => /cr[eé]dit|entr[eé]e|dep[oô]t/.test(c));
  const iSolde  = header.findIndex(c => /solde/.test(c));
  const iMont   = header.findIndex(c => /montant|amount/.test(c));

  const parseNum = (s: string) => {
    if (!s) return 0;
    const cleaned = s.replace(/\s/g, "").replace(",", ".").replace(/[^-0-9.]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : Math.abs(Math.round(n * 100) / 100);
  };
  const parseDate = (s: string): string | null => {
    if (!s) return null;
    // DD/MM/YYYY → YYYY-MM-DD
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const yyyy = y.length === 2 ? "20" + y : y;
      return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m2 ? m2[0] : null;
  };

  const lignes = rows.slice(1).map(r => {
    let debit = 0, credit = 0;
    if (iDeb >= 0 || iCred >= 0) {
      debit  = iDeb  >= 0 ? parseNum(r[iDeb])  : 0;
      credit = iCred >= 0 ? parseNum(r[iCred]) : 0;
    } else if (iMont >= 0) {
      const raw = r[iMont] ?? "";
      const num = parseFloat(raw.replace(/\s/g, "").replace(",", ".").replace(/[^-0-9.]/g, ""));
      if (num < 0) debit = Math.abs(num);
      else credit = num;
    }
    return {
      date:            iDate >= 0 ? parseDate(r[iDate]) : null,
      libelle:         iLib  >= 0 ? (r[iLib] ?? "") : r.join(" "),
      montant_debit:   debit,
      montant_credit:  credit,
      solde_courant:   iSolde >= 0 ? parseNum(r[iSolde]) : null,
    };
  }).filter(l => l.libelle.length > 0);

  return { periode_debut: null, periode_fin: null, solde_debut: null, solde_fin: null, lignes };
}

/** Convertit un File en base64 sans stack overflow (via FileReader). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier échouée"));
    reader.onload  = () => {
      const result = reader.result as string;
      // result = "data:application/pdf;base64,XXXX…" → on garde le bloc après la virgule
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

// ── Charges récurrentes ─────────────────────────────────────────────

function ChargesTab({ ctx }: { ctx: Ctx }) {
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<ChargeRecurrente | null>(null);
  const [form, setForm] = useState({ nom: "", categorie: "loyer", montant: "", frequence: "mensuel" as const, jour: "", notes: "" });

  function startEdit(c: ChargeRecurrente) {
    setEdit(c);
    setForm({
      nom: c.nom, categorie: c.categorie, montant: String(c.montant),
      frequence: c.frequence as "mensuel", jour: c.jour_prelevement ? String(c.jour_prelevement) : "",
      notes: c.notes ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!ctx.profile?.id) return;
    const payload = {
      restaurateur_id:  ctx.profile.id,
      nom:              form.nom.trim(),
      categorie:        form.categorie,
      montant:          parseFloat(form.montant) || 0,
      frequence:        form.frequence,
      jour_prelevement: form.jour ? parseInt(form.jour) : null,
      notes:            form.notes || null,
    };
    if (!payload.nom || payload.montant <= 0) { ctx.notify("error", "Nom et montant requis."); return; }
    const { error } = edit
      ? await ctx.supa.from("charges_recurrentes").update(payload).eq("id", edit.id)
      : await ctx.supa.from("charges_recurrentes").insert(payload);
    if (error) { ctx.notify("error", error.message); return; }
    ctx.notify("success", edit ? "Charge mise à jour." : "Charge ajoutée.");
    setShowForm(false); setEdit(null);
    setForm({ nom: "", categorie: "loyer", montant: "", frequence: "mensuel", jour: "", notes: "" });
    await ctx.reload();
  }

  async function toggleActif(c: ChargeRecurrente) {
    const { error } = await ctx.supa.from("charges_recurrentes").update({ actif: !c.actif }).eq("id", c.id);
    if (error) { ctx.notify("error", error.message); return; }
    await ctx.reload();
  }

  async function supprimer(c: ChargeRecurrente) {
    if (!confirm(`Supprimer "${c.nom}" et ses paiements ?`)) return;
    const { error } = await ctx.supa.from("charges_recurrentes").delete().eq("id", c.id);
    if (error) { ctx.notify("error", error.message); return; }
    ctx.notify("success", "Charge supprimée.");
    await ctx.reload();
  }

  async function logPaiement(c: ChargeRecurrente) {
    if (!ctx.profile?.id) return;
    const date = prompt("Date du prélèvement (YYYY-MM-DD) :", new Date().toISOString().slice(0, 10));
    if (!date) return;
    const montant = prompt("Montant :", String(c.montant));
    if (!montant) return;
    const reference = prompt("Référence (optionnel) :", "") || null;
    const { error } = await ctx.supa.from("charges_paiements").insert({
      restaurateur_id:  ctx.profile.id,
      charge_id:        c.id,
      date_prelevement: date,
      montant:          parseFloat(montant) || 0,
      reference,
    });
    if (error) { ctx.notify("error", error.message); return; }
    ctx.notify("success", "Paiement enregistré.");
    await ctx.reload();
  }

  // Prélèvements à venir dans 7 jours
  const prochains = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now); in7.setDate(now.getDate() + 7);
    return ctx.charges.filter(c => c.actif && c.jour_prelevement).map(c => {
      const jour = c.jour_prelevement!;
      const next = new Date(now.getFullYear(), now.getMonth(), jour);
      if (next < now) next.setMonth(next.getMonth() + 1);
      return { charge: c, date: next };
    }).filter(x => x.date <= in7).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [ctx.charges]);

  return (
    <div className="flex flex-col gap-5">
      {prochains.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">⏰ Prélèvements à venir dans 7 jours :</p>
          <ul className="mt-1 list-disc pl-5">
            {prochains.map(p => (
              <li key={p.charge.id}>{p.charge.nom} — {fmt(Number(p.charge.montant))} le {p.date.toLocaleDateString("fr-FR")}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1A1A2E]">Charges fixes</h3>
        <button onClick={() => { setShowForm(v => !v); setEdit(null); setForm({ nom: "", categorie: "loyer", montant: "", frequence: "mensuel", jour: "", notes: "" }); }}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md">
          {showForm ? "Annuler" : "+ Ajouter"}
        </button>
      </div>

      {showForm && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Nom</span>
              <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className={inputCls} placeholder="EDF — contrat pro" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Catégorie</span>
              <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} className={inputCls}>
                {CATEG_CHARGES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Montant (€)</span>
              <input type="number" step="0.01" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Fréquence</span>
              <select value={form.frequence} onChange={e => setForm({ ...form, frequence: e.target.value as "mensuel" })} className={inputCls}>
                <option value="mensuel">Mensuel</option>
                <option value="trimestriel">Trimestriel</option>
                <option value="annuel">Annuel</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Jour de prélèvement</span>
              <input type="number" min="1" max="31" value={form.jour} onChange={e => setForm({ ...form, jour: e.target.value })} className={inputCls} placeholder="ex : 5" />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Notes</span>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={save} className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600">
              {edit ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
        </section>
      )}

      {/* Liste */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {ctx.charges.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune charge enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Catégorie</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2 text-left">Fréquence</th>
                  <th className="px-3 py-2 text-right">Jour</th>
                  <th className="px-3 py-2 text-center">Actif</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ctx.charges.map(c => (
                  <tr key={c.id} className={c.actif ? "" : "opacity-50"}>
                    <td className="px-3 py-2 font-medium text-[#1A1A2E]">{c.nom}</td>
                    <td className="px-3 py-2 text-gray-500">{CATEG_CHARGES.find(x => x.id === c.categorie)?.label ?? c.categorie}</td>
                    <td className="px-3 py-2 text-right text-[#1A1A2E]">{fmt(Number(c.montant))}</td>
                    <td className="px-3 py-2 text-gray-500">{c.frequence}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{c.jour_prelevement ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => toggleActif(c)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.actif ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {c.actif ? "Actif" : "Inactif"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => logPaiement(c)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100">+ Paiement</button>
                        <button onClick={() => startEdit(c)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs hover:border-indigo-300">Éditer</button>
                        <button onClick={() => supprimer(c)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Suppr.</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Historique paiements */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Historique des paiements</h3>
        {ctx.chargePaiements.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun paiement enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Charge</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2 text-left">Réf.</th>
                <th className="px-3 py-2 text-center">Pointé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ctx.chargePaiements.slice(0, 30).map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-2">{new Date(p.date_prelevement).toLocaleDateString("fr-FR")}</td>
                  <td className="px-3 py-2 text-gray-600">{ctx.charges.find(c => c.id === p.charge_id)?.nom ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(p.montant))}</td>
                  <td className="px-3 py-2 text-gray-500">{p.reference ?? "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.releve_ligne_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {p.releve_ligne_id ? "✓" : "○"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ── Masse salariale ─────────────────────────────────────────────────

function SalairesTab({ ctx }: { ctx: Ctx }) {
  const [showFiche, setShowFiche] = useState(false);
  const [ficheForm, setFicheForm] = useState({ prenom: "", nom: "", poste: "", type_contrat: "CDI", date_embauche: "" });

  const [salaireForm, setSalaireForm] = useState<{
    employe_fiche_id: string; mois: string; brut: string; net: string;
    mode: "virement" | "especes" | "cheque"; virement_ref: string;
    urssaf_montant: string; urssaf_ref: string;
    prev_montant: string; prev_nom: string; prev_ref: string;
  }>({
    employe_fiche_id: "", mois: new Date().toISOString().slice(0, 7), brut: "", net: "",
    mode: "virement", virement_ref: "",
    urssaf_montant: "", urssaf_ref: "",
    prev_montant: "", prev_nom: "KLESIA", prev_ref: "",
  });
  const [showSalaire, setShowSalaire] = useState(false);

  const [stcForm, setStcForm] = useState({ employe_fiche_id: "", date: new Date().toISOString().slice(0, 10), montant: "", motif: "demission", mode: "virement", reference: "" });
  const [showStc, setShowStc] = useState(false);

  async function saveFiche() {
    if (!ctx.profile?.id) return;
    if (!ficheForm.prenom || !ficheForm.nom) { ctx.notify("error", "Prénom et nom requis."); return; }
    const { error } = await ctx.supa.from("employes_fiches").insert({
      restaurateur_id: ctx.profile.id,
      prenom:          ficheForm.prenom.trim(),
      nom:             ficheForm.nom.trim(),
      poste:           ficheForm.poste || null,
      type_contrat:    ficheForm.type_contrat,
      date_embauche:   ficheForm.date_embauche || null,
    });
    if (error) { ctx.notify("error", error.message); return; }
    ctx.notify("success", "Fiche ajoutée.");
    setShowFiche(false);
    setFicheForm({ prenom: "", nom: "", poste: "", type_contrat: "CDI", date_embauche: "" });
    await ctx.reload();
  }

  async function saveSalaire() {
    if (!ctx.profile?.id || !salaireForm.employe_fiche_id) { ctx.notify("error", "Sélectionnez un employé."); return; }
    const payload = {
      restaurateur_id:      ctx.profile.id,
      employe_fiche_id:     salaireForm.employe_fiche_id,
      mois:                 salaireForm.mois + "-01",
      salaire_brut:         parseFloat(salaireForm.brut) || 0,
      salaire_net:          parseFloat(salaireForm.net) || 0,
      mode_paiement:        salaireForm.mode,
      virement_reference:   salaireForm.mode === "virement" ? (salaireForm.virement_ref || null) : null,
      urssaf_montant:       parseFloat(salaireForm.urssaf_montant) || 0,
      urssaf_reference:     salaireForm.urssaf_ref || null,
      prevoyance_montant:   parseFloat(salaireForm.prev_montant) || 0,
      prevoyance_nom:       salaireForm.prev_nom || null,
      prevoyance_reference: salaireForm.prev_ref || null,
    };
    const { error } = await ctx.supa.from("salaires_mensuels")
      .upsert(payload, { onConflict: "employe_fiche_id,mois" });
    if (error) { ctx.notify("error", error.message); return; }
    ctx.notify("success", "Salaire enregistré.");
    setShowSalaire(false);
    await ctx.reload();
  }

  async function saveStc() {
    if (!ctx.profile?.id || !stcForm.employe_fiche_id) { ctx.notify("error", "Sélectionnez un employé."); return; }
    const { error } = await ctx.supa.from("soldes_tout_compte").insert({
      restaurateur_id:  ctx.profile.id,
      employe_fiche_id: stcForm.employe_fiche_id,
      date_sortie:      stcForm.date,
      montant:          parseFloat(stcForm.montant) || 0,
      motif:            stcForm.motif,
      mode_paiement:    stcForm.mode,
      reference:        stcForm.reference || null,
    });
    if (error) { ctx.notify("error", error.message); return; }
    await ctx.supa.from("employes_fiches").update({ actif: false, date_sortie: stcForm.date }).eq("id", stcForm.employe_fiche_id);
    ctx.notify("success", "Solde de tout compte enregistré.");
    setShowStc(false);
    await ctx.reload();
  }

  // Total masse salariale mois courant
  const moisKey = new Date().toISOString().slice(0, 7);
  const salairesMois = ctx.salaires.filter(s => s.mois.startsWith(moisKey));
  const totalNet = salairesMois.reduce((s, x) => s + Number(x.salaire_net), 0);
  const totalCharges = salairesMois.reduce((s, x) => s + Number(x.urssaf_montant) + Number(x.prevoyance_montant), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Employés actifs" value={String(ctx.fiches.filter(f => f.actif).length)} />
        <Kpi label={`Net versé — ${moisKey}`} value={fmt(totalNet)} />
        <Kpi label={`Charges — ${moisKey}`}   value={fmt(totalCharges)} />
        <Kpi label={`Total mois`}             value={fmt(totalNet + totalCharges)} accent="rose" />
      </div>

      {/* Fiches */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Fiches employés</h3>
          <button onClick={() => setShowFiche(v => !v)} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-white">
            + Nouvelle fiche
          </button>
        </div>
        {showFiche && (
          <div className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
            <input value={ficheForm.prenom} onChange={e => setFicheForm({ ...ficheForm, prenom: e.target.value })} placeholder="Prénom" className={inputCls} />
            <input value={ficheForm.nom}    onChange={e => setFicheForm({ ...ficheForm, nom: e.target.value })}    placeholder="Nom"    className={inputCls} />
            <input value={ficheForm.poste}  onChange={e => setFicheForm({ ...ficheForm, poste: e.target.value })}  placeholder="Poste (ex : Serveur)" className={inputCls} />
            <select value={ficheForm.type_contrat} onChange={e => setFicheForm({ ...ficheForm, type_contrat: e.target.value })} className={inputCls}>
              <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Extra">Extra</option>
              <option value="Apprentissage">Apprentissage</option><option value="Stage">Stage</option>
            </select>
            <input type="date" value={ficheForm.date_embauche} onChange={e => setFicheForm({ ...ficheForm, date_embauche: e.target.value })} className={inputCls} />
            <div className="flex justify-end sm:col-span-2">
              <button onClick={saveFiche} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
            </div>
          </div>
        )}
        {ctx.fiches.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Aucune fiche.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Poste</th>
                <th className="px-3 py-2 text-left">Contrat</th>
                <th className="px-3 py-2 text-left">Embauche</th>
                <th className="px-3 py-2 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ctx.fiches.map(f => (
                <tr key={f.id} className={f.actif ? "" : "opacity-60"}>
                  <td className="px-3 py-2 font-medium text-[#1A1A2E]">{f.prenom} {f.nom}</td>
                  <td className="px-3 py-2 text-gray-500">{f.poste ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{f.type_contrat ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{f.date_embauche ? new Date(f.date_embauche).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.actif ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {f.actif ? "Actif" : `Sorti ${f.date_sortie ? new Date(f.date_sortie).toLocaleDateString("fr-FR") : ""}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Saisie salaire */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Saisir un salaire mensuel</h3>
          <button onClick={() => setShowSalaire(v => !v)} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-semibold text-white">
            {showSalaire ? "Fermer" : "+ Nouvelle paie"}
          </button>
        </div>
        {showSalaire && (
          <div className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
            <select value={salaireForm.employe_fiche_id} onChange={e => setSalaireForm({ ...salaireForm, employe_fiche_id: e.target.value })} className={inputCls}>
              <option value="">Employé…</option>
              {ctx.fiches.filter(f => f.actif).map(f => <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>)}
            </select>
            <input type="month" value={salaireForm.mois} onChange={e => setSalaireForm({ ...salaireForm, mois: e.target.value })} className={inputCls} />
            <input type="number" step="0.01" placeholder="Salaire brut" value={salaireForm.brut} onChange={e => setSalaireForm({ ...salaireForm, brut: e.target.value })} className={inputCls} />
            <input type="number" step="0.01" placeholder="Net versé"    value={salaireForm.net}  onChange={e => setSalaireForm({ ...salaireForm, net: e.target.value })}  className={inputCls} />
            <select value={salaireForm.mode} onChange={e => setSalaireForm({ ...salaireForm, mode: e.target.value as "virement" })} className={inputCls}>
              <option value="virement">Virement</option><option value="especes">Espèces</option><option value="cheque">Chèque</option>
            </select>
            <input placeholder="Réf. virement" value={salaireForm.virement_ref} onChange={e => setSalaireForm({ ...salaireForm, virement_ref: e.target.value })} className={inputCls} />
            <input type="number" step="0.01" placeholder="URSSAF — montant" value={salaireForm.urssaf_montant} onChange={e => setSalaireForm({ ...salaireForm, urssaf_montant: e.target.value })} className={inputCls} />
            <input placeholder="URSSAF — réf. paiement" value={salaireForm.urssaf_ref} onChange={e => setSalaireForm({ ...salaireForm, urssaf_ref: e.target.value })} className={inputCls} />
            <input placeholder="Prévoyance (ex: KLESIA)" value={salaireForm.prev_nom} onChange={e => setSalaireForm({ ...salaireForm, prev_nom: e.target.value })} className={inputCls} />
            <input type="number" step="0.01" placeholder="Prévoyance — montant" value={salaireForm.prev_montant} onChange={e => setSalaireForm({ ...salaireForm, prev_montant: e.target.value })} className={inputCls} />
            <input placeholder="Prévoyance — réf." value={salaireForm.prev_ref} onChange={e => setSalaireForm({ ...salaireForm, prev_ref: e.target.value })} className={inputCls + " sm:col-span-2"} />
            <div className="flex justify-end sm:col-span-2">
              <button onClick={saveSalaire} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">Enregistrer</button>
            </div>
          </div>
        )}
        {/* Liste des derniers salaires */}
        {ctx.salaires.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left">Mois</th>
                <th className="px-3 py-2 text-left">Employé</th>
                <th className="px-3 py-2 text-right">Brut</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-right">URSSAF</th>
                <th className="px-3 py-2 text-right">Prévoyance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ctx.salaires.slice(0, 20).map(s => {
                const f = ctx.fiches.find(fi => fi.id === s.employe_fiche_id);
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2">{s.mois.slice(0, 7)}</td>
                    <td className="px-3 py-2">{f ? `${f.prenom} ${f.nom}` : "—"}</td>
                    <td className="px-3 py-2 text-right">{fmt(Number(s.salaire_brut))}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(Number(s.salaire_net))}</td>
                    <td className="px-3 py-2 text-right">{fmt(Number(s.urssaf_montant))}</td>
                    <td className="px-3 py-2 text-right">{fmt(Number(s.prevoyance_montant))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* STC */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Solde de tout compte</h3>
          <button onClick={() => setShowStc(v => !v)} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-indigo-300">
            {showStc ? "Fermer" : "+ Nouveau STC"}
          </button>
        </div>
        {showStc && (
          <div className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
            <select value={stcForm.employe_fiche_id} onChange={e => setStcForm({ ...stcForm, employe_fiche_id: e.target.value })} className={inputCls}>
              <option value="">Employé…</option>
              {ctx.fiches.map(f => <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>)}
            </select>
            <input type="date" value={stcForm.date} onChange={e => setStcForm({ ...stcForm, date: e.target.value })} className={inputCls} />
            <input type="number" step="0.01" placeholder="Montant" value={stcForm.montant} onChange={e => setStcForm({ ...stcForm, montant: e.target.value })} className={inputCls} />
            <select value={stcForm.motif} onChange={e => setStcForm({ ...stcForm, motif: e.target.value })} className={inputCls}>
              <option value="demission">Démission</option>
              <option value="licenciement">Licenciement</option>
              <option value="fin_cdd">Fin CDD</option>
              <option value="rupture_conventionnelle">Rupture conventionnelle</option>
              <option value="autre">Autre</option>
            </select>
            <select value={stcForm.mode} onChange={e => setStcForm({ ...stcForm, mode: e.target.value })} className={inputCls}>
              <option value="virement">Virement</option><option value="especes">Espèces</option><option value="cheque">Chèque</option>
            </select>
            <input placeholder="Référence" value={stcForm.reference} onChange={e => setStcForm({ ...stcForm, reference: e.target.value })} className={inputCls} />
            <div className="flex justify-end sm:col-span-2">
              <button onClick={saveStc} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white">Enregistrer STC</button>
            </div>
          </div>
        )}
        {ctx.stcs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Aucun STC enregistré.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Employé</th>
                <th className="px-3 py-2 text-left">Motif</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2 text-left">Réf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ctx.stcs.map(s => {
                const f = ctx.fiches.find(fi => fi.id === s.employe_fiche_id);
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-2">{new Date(s.date_sortie).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2">{f ? `${f.prenom} ${f.nom}` : "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{s.motif ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(Number(s.montant))}</td>
                    <td className="px-3 py-2 text-gray-500">{s.reference ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ── Dépenses exceptionnelles ────────────────────────────────────────

function ExceptionnellesTab({ ctx }: { ctx: Ctx }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", montant: "", categorie: "reparation", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!ctx.profile?.id) return;
    if (!form.description || !form.montant) { ctx.notify("error", "Description et montant requis."); return; }
    setSaving(true);
    try {
      let justUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${ctx.profile.id}/exceptionnelles/${Date.now()}.${ext}`;
        const { error: upErr } = await ctx.supa.storage.from("justificatifs").upload(path, file, { contentType: file.type });
        if (upErr) throw new Error("Upload échoué : " + upErr.message);
        justUrl = path;
      }
      const { error } = await ctx.supa.from("depenses_exceptionnelles").insert({
        restaurateur_id:  ctx.profile.id,
        date_dep:         form.date,
        description:      form.description,
        montant:          parseFloat(form.montant) || 0,
        categorie:        form.categorie,
        justificatif_url: justUrl,
        notes:            form.notes || null,
      });
      if (error) throw new Error(error.message);
      ctx.notify("success", "Dépense enregistrée.");
      setForm({ date: new Date().toISOString().slice(0, 10), description: "", montant: "", categorie: "reparation", notes: "" });
      setFile(null); setShowForm(false);
      await ctx.reload();
    } catch (e) {
      ctx.notify("error", e instanceof Error ? e.message : "Erreur");
    }
    setSaving(false);
  }

  async function viewJustif(path: string) {
    const { data, error } = await ctx.supa.storage.from("justificatifs").createSignedUrl(path, 3600);
    if (error || !data) { ctx.notify("error", "Justificatif inaccessible."); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function supprimer(d: DepenseExceptionnelle) {
    if (!confirm("Supprimer cette dépense ?")) return;
    if (d.justificatif_url) await ctx.supa.storage.from("justificatifs").remove([d.justificatif_url]);
    const { error } = await ctx.supa.from("depenses_exceptionnelles").delete().eq("id", d.id);
    if (error) { ctx.notify("error", error.message); return; }
    ctx.notify("success", "Dépense supprimée.");
    await ctx.reload();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1A1A2E]">Dépenses exceptionnelles</h3>
        <button onClick={() => setShowForm(v => !v)} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-md">
          {showForm ? "Annuler" : "+ Ajouter"}
        </button>
      </div>
      {showForm && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
            <input type="number" step="0.01" placeholder="Montant" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} className={inputCls} />
            <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls + " sm:col-span-2"} />
            <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} className={inputCls}>
              {CATEG_EXCEPT.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-indigo-300">
              <input type="file" accept="image/*,application/pdf" hidden
                     onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <span>📎 {file ? file.name : "Justificatif (photo/PDF)"}</span>
            </label>
            <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls + " sm:col-span-2"} />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={save} disabled={saving} className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {ctx.exceps.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune dépense enregistrée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2 text-center">Justif.</th>
                <th className="px-3 py-2 text-center">Pointé</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ctx.exceps.map(d => (
                <tr key={d.id}>
                  <td className="px-3 py-2">{new Date(d.date_dep).toLocaleDateString("fr-FR")}</td>
                  <td className="px-3 py-2 text-gray-700">{d.description}</td>
                  <td className="px-3 py-2 text-gray-500">{CATEG_EXCEPT.find(c => c.id === d.categorie)?.label ?? d.categorie}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(Number(d.montant))}</td>
                  <td className="px-3 py-2 text-center">
                    {d.justificatif_url ? (
                      <button onClick={() => viewJustif(d.justificatif_url!)} className="text-indigo-600 hover:underline">Voir</button>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.releve_ligne_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {d.releve_ligne_id ? "✓" : "○"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => supprimer(d)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">Suppr.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ── Pointage global ─────────────────────────────────────────────────

function PointageTab({ ctx }: { ctx: Ctx }) {
  const [mois, setMois] = useState<string>(new Date().toISOString().slice(0, 7));

  type LigneDep = { source: string; date: string; libelle: string; montant: number; pointe: boolean; ref: string };

  const lignes: LigneDep[] = useMemo(() => {
    const out: LigneDep[] = [];
    ctx.commandes.filter(c => c.created_at.startsWith(mois) && c.statut !== "annulee").forEach(c => {
      out.push({
        source: "Facture fournisseur",
        date:   c.created_at.slice(0, 10),
        libelle:`Commande ${c.id.slice(0, 8)}`,
        montant:montantNet(c),
        pointe: false, // On ne les relie pas encore automatiquement
        ref:    c.id,
      });
    });
    ctx.chargePaiements.filter(p => p.date_prelevement.startsWith(mois)).forEach(p => {
      const charge = ctx.charges.find(c => c.id === p.charge_id);
      out.push({ source: "Charge fixe", date: p.date_prelevement, libelle: charge?.nom ?? "—", montant: Number(p.montant), pointe: !!p.releve_ligne_id, ref: p.id });
    });
    ctx.salaires.filter(s => s.mois.startsWith(mois)).forEach(s => {
      const f = ctx.fiches.find(fi => fi.id === s.employe_fiche_id);
      out.push({ source: "Salaire", date: s.mois.slice(0, 10), libelle: f ? `${f.prenom} ${f.nom}` : "—", montant: Number(s.salaire_net), pointe: !!s.releve_ligne_id, ref: s.id });
    });
    ctx.stcs.filter(s => s.date_sortie.startsWith(mois)).forEach(s => {
      const f = ctx.fiches.find(fi => fi.id === s.employe_fiche_id);
      out.push({ source: "STC", date: s.date_sortie, libelle: f ? `${f.prenom} ${f.nom}` : "—", montant: Number(s.montant), pointe: !!s.releve_ligne_id, ref: s.id });
    });
    ctx.exceps.filter(d => d.date_dep.startsWith(mois)).forEach(d => {
      out.push({ source: "Exceptionnel", date: d.date_dep, libelle: d.description, montant: Number(d.montant), pointe: !!d.releve_ligne_id, ref: d.id });
    });
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [mois, ctx.commandes, ctx.chargePaiements, ctx.salaires, ctx.stcs, ctx.exceps, ctx.charges, ctx.fiches]);

  const total = lignes.reduce((s, l) => s + l.montant, 0);
  const pointes = lignes.filter(l => l.pointe).length;

  function exportCsv() {
    const header = ["Source", "Date", "Libellé", "Montant", "Pointé"];
    const rows = lignes.map(l => [l.source, l.date, l.libelle.replace(/;/g, ","), String(l.montant), l.pointe ? "✓" : "○"]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pointage-${mois}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Mois</span>
            <input type="month" value={mois} onChange={e => setMois(e.target.value)} className={inputCls + " w-48"} />
          </label>
          <div className="flex-1" />
          <button onClick={exportCsv} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:border-indigo-300">
            ↓ Export CSV
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Dépenses du mois" value={fmt(total)} />
        <Kpi label="Pointées"         value={`${pointes} / ${lignes.length}`} accent={pointes === lignes.length && lignes.length > 0 ? "emerald" : undefined} />
        <Kpi label="Reste à pointer"  value={String(lignes.length - pointes)} accent={lignes.length - pointes > 0 ? "rose" : "emerald"} />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Détail des dépenses — {mois}</h3>
        {lignes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune dépense ce mois-ci.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Libellé</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{l.source}</span>
                    </td>
                    <td className="px-3 py-2">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2 text-gray-700">{l.libelle}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(l.montant)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.pointe ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {l.pointe ? "✓ Pointé" : "En attente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Kpi shared ──────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "rose" | "emerald" }) {
  const cls = accent === "rose" ? "border-rose-200 bg-rose-50 text-rose-700"
            : accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-gray-200 bg-white text-[#1A1A2E]";
  const [b, bg, txt] = cls.split(" ");
  return (
    <div className={`rounded-xl border ${b} ${bg} p-3 shadow-sm`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${txt}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-500">{sub}</p>}
    </div>
  );
}
