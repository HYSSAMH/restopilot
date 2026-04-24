"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";

interface Profil {
  id: string;
  nom_commercial: string | null;
  nom_etablissement: string | null;
  raison_sociale: string | null;
  siret: string | null;
  telephone: string | null;
  email_contact: string | null;
  email: string | null;
  adresse_ligne1: string | null;
  adresse_ligne2: string | null;
  code_postal: string | null;
  ville: string | null;
  type_restaurant: string | null;
  nombre_couverts: number | null;
}

interface Commande {
  id: string;
  statut: string;
  montant_total: number;
  avoir_montant: number | null;
  avoir_statut: string | null;
  created_at: string;
  lignes_commande: { nom_snapshot: string; prix_snapshot: number; unite: string; quantite: number }[];
}

interface Paiement {
  id: string;
  commande_id: string | null;
  montant: number;
  mode: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface Conditions {
  delai_paiement_jours: number;
  remise_pct: number;
  montant_min: number;
  notes: string | null;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params);

  const [profil, setProfil]       = useState<Profil | null>(null);
  const [commandes, setCmds]      = useState<Commande[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [conditions, setConditions] = useState<Conditions>({
    delai_paiement_jours: 30, remise_pct: 0, montant_min: 0, notes: null,
  });
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"overview" | "historique" | "releve" | "paiements" | "conditions">("overview");

  const [addPayOpen, setAddPayOpen] = useState(false);
  const [newPay, setNewPay] = useState({ commande_id: "", montant: "", mode: "virement", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const loadAll = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    console.group("[Fiche client] chargement");
    console.log("Fournisseur connecté (auth.uid) :", user.id);
    console.log("Client ID demandé (param URL) :",  clientId);

    const [profRes, cmdsRes, paysRes, condRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", clientId).maybeSingle(),
      supabase.from("commandes")
        .select("id, statut, montant_total, avoir_montant, avoir_statut, created_at, restaurateur_nom, lignes_commande ( nom_snapshot, prix_snapshot, unite, quantite )")
        .eq("fournisseur_id", user.id).eq("restaurateur_id", clientId)
        .order("created_at", { ascending: false }),
      supabase.from("paiements")
        .select("id, commande_id, montant, mode, reference, notes, created_at")
        .eq("fournisseur_id", user.id).eq("restaurateur_id", clientId)
        .order("created_at", { ascending: false }),
      supabase.from("clients_fournisseur")
        .select("delai_paiement_jours, remise_pct, montant_min, notes")
        .eq("fournisseur_id", user.id).eq("restaurateur_id", clientId).maybeSingle(),
    ]);

    console.log("Profil reçu :", profRes.data);
    if (profRes.error) console.error("Erreur profil :", profRes.error);
    console.log("Commandes reçues :", cmdsRes.data?.length ?? 0);
    if (cmdsRes.error) console.error("Erreur commandes :", cmdsRes.error);
    console.log("Paiements reçus :", paysRes.data?.length ?? 0);
    if (paysRes.error) console.error("Erreur paiements :", paysRes.error);
    console.log("Conditions :", condRes.data);

    let profil = profRes.data as Profil | null;

    // Fallback : si le profil est null mais qu'il existe des commandes pour
    // ce client, on hydrate un profil minimal depuis restaurateur_nom.
    // Cause typique : la policy RLS profiles_select_clients n'a pas été
    // appliquée (migration_clients_rls_fix.sql à exécuter).
    if (!profil && cmdsRes.data && cmdsRes.data.length > 0) {
      console.warn(
        "⚠ Profil restaurateur introuvable via RLS mais commandes présentes.\n" +
        "  → Exécutez supabase/migration_clients_rls_fix.sql pour ajouter la policy profiles_select_clients.\n" +
        "  Affichage en mode dégradé (nom issu de commandes.restaurateur_nom)."
      );
      const first = cmdsRes.data[0] as { restaurateur_nom?: string };
      profil = {
        id: clientId,
        nom_commercial:    null,
        nom_etablissement: first.restaurateur_nom ?? "Client",
        raison_sociale:    null,
        siret:             null,
        telephone:         null,
        email_contact:     null,
        email:             null,
        adresse_ligne1:    null,
        adresse_ligne2:    null,
        code_postal:       null,
        ville:             null,
        type_restaurant:   null,
        nombre_couverts:   null,
      };
    }

    console.groupEnd();

    setProfil(profil);
    setCmds((cmdsRes.data ?? []) as Commande[]);
    setPaiements((paysRes.data ?? []) as Paiement[]);
    if (condRes.data) setConditions(condRes.data as Conditions);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Agrégats ──
  const caTotal = useMemo(() =>
    commandes
      .filter(c => c.statut !== "annulee")
      .reduce((s, c) => {
        const avoirAcc = c.avoir_statut === "accepte" ? Number(c.avoir_montant ?? 0) : 0;
        return s + Number(c.montant_total) - avoirAcc;
      }, 0),
  [commandes]);
  const totalPaye = useMemo(() => paiements.reduce((s, p) => s + Number(p.montant), 0), [paiements]);
  const solde     = Math.max(0, Math.round((caTotal - totalPaye) * 100) / 100);

  const nbCommandes = commandes.filter(c => c.statut !== "annulee").length;
  const panierMoyen = nbCommandes > 0 ? caTotal / nbCommandes : 0;

  // CA par mois (12 derniers mois)
  const evolution = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toISOString().slice(0, 7);
      map.set(k, 0);
    }
    commandes.filter(c => c.statut !== "annulee").forEach(c => {
      const k = c.created_at.slice(0, 7);
      if (map.has(k)) {
        const avoirAcc = c.avoir_statut === "accepte" ? Number(c.avoir_montant ?? 0) : 0;
        map.set(k, (map.get(k) ?? 0) + Number(c.montant_total) - avoirAcc);
      }
    });
    return Array.from(map.entries()).map(([k, v]) => ({ mois: k, valeur: v }));
  }, [commandes]);
  const maxEvo = Math.max(...evolution.map(e => e.valeur), 1);

  // Top produits
  const topProduits = useMemo(() => {
    const map = new Map<string, { nom: string; qte: number; valeur: number }>();
    commandes.filter(c => c.statut !== "annulee").forEach(c => {
      c.lignes_commande.forEach(l => {
        const k = l.nom_snapshot.toLowerCase().trim();
        if (!map.has(k)) map.set(k, { nom: l.nom_snapshot, qte: 0, valeur: 0 });
        const e = map.get(k)!;
        e.qte    += Number(l.quantite);
        e.valeur += Number(l.quantite) * Number(l.prix_snapshot);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.valeur - a.valeur).slice(0, 5);
  }, [commandes]);

  // Relevé chronologique : commandes + avoirs + paiements
  const releve = useMemo(() => {
    type Line = { date: string; type: string; ref: string; debit: number; credit: number };
    const lines: Line[] = [];

    commandes.filter(c => c.statut !== "annulee").forEach(c => {
      lines.push({
        date: c.created_at,
        type: "Facture",
        ref:  c.id.slice(0, 8).toUpperCase(),
        debit:  Number(c.montant_total),
        credit: 0,
      });
      if (c.avoir_statut === "accepte" && Number(c.avoir_montant ?? 0) > 0) {
        lines.push({
          date: c.created_at,
          type: "Avoir",
          ref:  c.id.slice(0, 8).toUpperCase(),
          debit:  0,
          credit: Number(c.avoir_montant),
        });
      }
    });
    paiements.forEach(p => {
      lines.push({
        date: p.created_at,
        type: `Paiement${p.mode ? ` (${p.mode})` : ""}`,
        ref:  p.reference || p.id.slice(0, 8).toUpperCase(),
        debit:  0,
        credit: Number(p.montant),
      });
    });
    lines.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return lines.map(l => {
      running += l.debit - l.credit;
      return { ...l, solde: running };
    });
  }, [commandes, paiements]);

  async function addPaiement() {
    const m = parseFloat(newPay.montant);
    if (!m || m <= 0) { setToast({ type: "error", msg: "Montant invalide." }); return; }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("paiements").insert({
      commande_id:     newPay.commande_id || null,
      fournisseur_id:  user.id,
      restaurateur_id: clientId,
      montant:         m,
      mode:            newPay.mode || null,
      reference:       newPay.reference || null,
      notes:           newPay.notes || null,
    });
    setSaving(false);
    if (error) { setToast({ type: "error", msg: error.message }); return; }
    setNewPay({ commande_id: "", montant: "", mode: "virement", reference: "", notes: "" });
    setAddPayOpen(false);
    setToast({ type: "success", msg: "Paiement enregistré." });
    loadAll();
  }

  async function deletePaiement(id: string) {
    if (!confirm("Supprimer ce paiement ?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("paiements").delete().eq("id", id);
    if (!error) loadAll();
  }

  async function saveConditions() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("clients_fournisseur").upsert({
      fournisseur_id:       user.id,
      restaurateur_id:      clientId,
      delai_paiement_jours: conditions.delai_paiement_jours,
      remise_pct:           conditions.remise_pct,
      montant_min:          conditions.montant_min,
      notes:                conditions.notes,
    });
    setSaving(false);
    if (error) setToast({ type: "error", msg: error.message });
    else       setToast({ type: "success", msg: "Conditions enregistrées." });
  }

  function exportReleveCsv() {
    const rows: (string | number)[][] = [
      ["Date", "Type", "Référence", "Débit", "Crédit", "Solde"],
      ...releve.map(l => [
        fmtDate(l.date),
        l.type,
        l.ref,
        l.debit > 0 ? l.debit.toFixed(2) : "",
        l.credit > 0 ? l.credit.toFixed(2) : "",
        l.solde.toFixed(2),
      ]),
    ];
    downloadCsv(`releve-${(profil?.nom_commercial || "client").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`, rows);
  }

  if (loading) {
    return (
      <DashboardLayout role="fournisseur">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
          <div className="h-64 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
        </div>
      </DashboardLayout>
    );
  }
  if (!profil) {
    return (
      <DashboardLayout role="fournisseur">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
          <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-6">
            <p className="font-semibold text-amber-800">Client introuvable</p>
            <p className="mt-2 text-sm text-amber-700">
              Aucune commande ni profil n&apos;est associé à cet identifiant pour votre compte.
            </p>
            <p className="mt-3 text-xs text-amber-700/80">
              ID demandé : <code className="rounded bg-white/50 px-1.5 py-0.5 font-mono">{clientId}</code>
            </p>
            <p className="mt-3 text-xs text-amber-700/80">
              Si vous êtes sûr que ce client a passé une commande chez vous, il se peut que la policy RLS
              <code className="mx-1 rounded bg-white/50 px-1.5 py-0.5 font-mono">profiles_select_clients</code>
              ne soit pas installée. Exécutez
              <code className="mx-1 rounded bg-white/50 px-1.5 py-0.5 font-mono">supabase/migration_clients_rls_fix.sql</code>
              dans Supabase SQL Editor.
            </p>
          </div>
          <Link href="/dashboard/fournisseur/clients" className="mt-4 inline-block text-[var(--accent)] hover:text-[var(--accent)]">
            ← Retour à la liste
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const nom = profil.nom_commercial || profil.nom_etablissement || "Client";
  const adrFull = [profil.adresse_ligne1, profil.adresse_ligne2, [profil.code_postal, profil.ville].filter(Boolean).join(" ")]
                    .filter(Boolean).join(" · ");

  return (
    <DashboardLayout role="fournisseur">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/fournisseur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/fournisseur/clients" className="hover:text-gray-600">Clients</Link>
          <span>/</span>
          <span className="truncate text-gray-600">{nom}</span>
        </div>

        {/* Header */}
        <div className="mb-6 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent)] text-xl font-bold text-white">
              {nom.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[var(--text)]">{nom}</h1>
              {profil.raison_sociale && <p className="text-sm text-gray-600">{profil.raison_sociale}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {[profil.siret ? `SIRET ${profil.siret}` : null, profil.telephone, profil.email_contact || profil.email].filter(Boolean).join(" · ")}
              </p>
              {adrFull && <p className="text-xs text-gray-500">{adrFull}</p>}
              {(profil.type_restaurant || profil.nombre_couverts) && (
                <p className="mt-1 text-xs text-gray-500">
                  {profil.type_restaurant}
                  {profil.type_restaurant && profil.nombre_couverts ? " · " : ""}
                  {profil.nombre_couverts ? `${profil.nombre_couverts} couverts` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-1 rounded-[8px] border border-[var(--border)] bg-white p-1 w-fit">
          {([
            { id: "overview",   label: "Vue d'ensemble" },
            { id: "historique", label: "Historique" },
            { id: "releve",     label: "Relevé" },
            { id: "paiements",  label: "Paiements" },
            { id: "conditions", label: "Conditions" },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t.id ? "bg-[var(--accent)] text-white" : "text-gray-500 hover:text-[var(--text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="CA total"       value={fmt(caTotal)} />
              <Kpi label="Solde dû"       value={fmt(solde)} accent={solde > 0 ? "rose" : "emerald"} />
              <Kpi label="Nb commandes"   value={nbCommandes.toString()} />
              <Kpi label="Panier moyen"   value={fmt(panierMoyen)} />
            </div>

            <div className="rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[var(--text)]">Évolution CA (12 derniers mois)</h2>
              <div className="mt-4 grid grid-cols-12 gap-1.5 items-end" style={{ height: 120 }}>
                {evolution.map(e => {
                  const pct = e.valeur / maxEvo;
                  return (
                    <div key={e.mois} className="flex flex-col items-center gap-1">
                      <div className="flex-1 w-full flex items-end">
                        <div
                          className="w-full rounded-t bg-[var(--accent)] transition-all"
                          style={{ height: `${Math.max(2, pct * 100)}%`, opacity: pct > 0 ? 1 : 0.2 }}
                          title={fmt(e.valeur)}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400">{e.mois.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[var(--text)]">Top produits achetés</h2>
              {topProduits.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">Aucun historique encore.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {topProduits.map((p, i) => (
                    <div key={p.nom} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-subtle)] px-3 py-2">
                      <span className="flex items-center gap-2 truncate text-sm">
                        <span className="w-5 text-xs text-gray-400">#{i + 1}</span>
                        <span className="truncate text-[var(--text)]">{p.nom}</span>
                      </span>
                      <span className="shrink-0 text-sm text-gray-500">
                        {p.qte} unités · <span className="font-semibold text-[var(--text)]">{fmt(p.valeur)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORIQUE */}
        {tab === "historique" && (
          <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Réf.</th>
                  <th className="px-5 py-3 text-left">Statut</th>
                  <th className="px-5 py-3 text-right">Montant</th>
                  <th className="px-5 py-3 text-right">Avoir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {commandes.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-500">Aucune commande.</td></tr>
                ) : commandes.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-[var(--bg-subtle)]"}>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-3 font-mono text-gray-700">{c.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-5 py-3 text-gray-700">{c.statut.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3 text-right font-semibold">{fmt(c.montant_total)}</td>
                    <td className="px-5 py-3 text-right text-rose-600">
                      {c.avoir_statut === "accepte" && c.avoir_montant ? `−${fmt(Number(c.avoir_montant))}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* RELEVÉ */}
        {tab === "releve" && (
          <div>
            <div className="mb-3 flex flex-wrap justify-end gap-2">
              <button
                onClick={exportReleveCsv}
                className="min-h-[40px] rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-indigo-300"
              >
                ↓ CSV
              </button>
              <button
                disabled
                title="Nécessite un provider SMTP (à activer côté serveur)"
                className="min-h-[40px] rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium text-gray-400"
              >
                ✉ Envoyer par email (bientôt)
              </button>
            </div>
            <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Référence</th>
                    <th className="px-5 py-3 text-right">Débit</th>
                    <th className="px-5 py-3 text-right">Crédit</th>
                    <th className="px-5 py-3 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {releve.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-500">Aucune ligne.</td></tr>
                  ) : releve.map((l, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[var(--bg-subtle)]"}>
                      <td className="px-5 py-3 text-gray-500">{fmtDate(l.date)}</td>
                      <td className="px-5 py-3 text-[var(--text)]">{l.type}</td>
                      <td className="px-5 py-3 font-mono text-gray-600">{l.ref}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{l.debit > 0 ? fmt(l.debit) : "—"}</td>
                      <td className="px-5 py-3 text-right text-emerald-600">{l.credit > 0 ? fmt(l.credit) : "—"}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${l.solde > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {fmt(l.solde)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAIEMENTS */}
        {tab === "paiements" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-500">
                Total payé : <span className="font-semibold text-[var(--text)]">{fmt(totalPaye)}</span>
                {" · "}Solde dû : <span className={`font-semibold ${solde > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(solde)}</span>
              </div>
              <button
                onClick={() => setAddPayOpen(true)}
                className="min-h-[44px] rounded-[8px] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[var(--accent-hover)]"
              >
                + Enregistrer un paiement
              </button>
            </div>

            <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Mode</th>
                    <th className="px-5 py-3 text-left">Référence</th>
                    <th className="px-5 py-3 text-left">Notes</th>
                    <th className="px-5 py-3 text-right">Montant</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paiements.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-gray-500">Aucun paiement enregistré.</td></tr>
                  ) : paiements.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-[var(--bg-subtle)]"}>
                      <td className="px-5 py-3 text-gray-500">{fmtDate(p.created_at)}</td>
                      <td className="px-5 py-3 text-gray-700">{p.mode ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-600">{p.reference ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-600">{p.notes ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-600">{fmt(p.montant)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deletePaiement(p.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONDITIONS */}
        {tab === "conditions" && (
          <div className="rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-[var(--text)]">Conditions commerciales</h2>
            <p className="mt-1 text-xs text-gray-500">
              Paramètres spécifiques à ce client. Non visible par le restaurateur.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Délai de paiement (jours)</label>
                <select
                  value={conditions.delai_paiement_jours}
                  onChange={e => setConditions({ ...conditions, delai_paiement_jours: parseInt(e.target.value, 10) })}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {[0, 7, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d === 0 ? "Comptant" : `${d} jours`}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Remise commerciale (%)</label>
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={conditions.remise_pct}
                  onChange={e => setConditions({ ...conditions, remise_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Min. de commande (€)</label>
                <input
                  type="number" min="0" step="1"
                  value={conditions.montant_min}
                  onChange={e => setConditions({ ...conditions, montant_min: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Notes internes (non visibles par le client)</label>
              <textarea
                rows={4}
                value={conditions.notes ?? ""}
                onChange={e => setConditions({ ...conditions, notes: e.target.value })}
                placeholder="ex : contact privilégié le mardi, accepte les livraisons tôt le matin…"
                className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:shadow-[0_0_0_3px_var(--accent-soft)]"
              />
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={saveConditions}
                disabled={saving}
                className="min-h-[44px] rounded-[8px] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {saving ? "Sauvegarde…" : "Enregistrer"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modale Ajout Paiement */}
      {addPayOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[var(--border)] bg-white shadow-2xl">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-lg font-bold text-[var(--text)]">Enregistrer un paiement</h2>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Commande concernée (optionnel)</label>
                <select
                  value={newPay.commande_id}
                  onChange={e => setNewPay({ ...newPay, commande_id: e.target.value })}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="">— Paiement général / partiel —</option>
                  {commandes.filter(c => c.statut !== "annulee").slice(0, 30).map(c => (
                    <option key={c.id} value={c.id}>
                      {fmtDate(c.created_at)} · {c.id.slice(0, 8).toUpperCase()} · {fmt(c.montant_total)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Montant (€) *</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={newPay.montant}
                    onChange={e => setNewPay({ ...newPay, montant: e.target.value })}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Mode</label>
                  <select
                    value={newPay.mode}
                    onChange={e => setNewPay({ ...newPay, mode: e.target.value })}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="especes">Espèces</option>
                    <option value="carte">Carte</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Référence</label>
                <input
                  value={newPay.reference}
                  onChange={e => setNewPay({ ...newPay, reference: e.target.value })}
                  placeholder="ex : VIR-20260420 ou n° chèque"
                  className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Notes</label>
                <input
                  value={newPay.notes}
                  onChange={e => setNewPay({ ...newPay, notes: e.target.value })}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-3">
              <button
                onClick={() => setAddPayOpen(false)}
                disabled={saving}
                className="min-h-[44px] rounded-[8px] border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={addPaiement}
                disabled={saving}
                className="min-h-[44px] rounded-[8px] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-xs rounded-[10px] border px-4 py-3 shadow-2xl ${
          toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}
    </DashboardLayout>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "rose" | "emerald" }) {
  const cls =
    accent === "rose"    ? "text-rose-600"    :
    accent === "emerald" ? "text-emerald-600" :
                           "text-[var(--text)]";
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}
