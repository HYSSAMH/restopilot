"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { createClient } from "@/lib/supabase/client";
import { regenerateAvoirPDF } from "@/lib/avoir-from-db";

type AvoirStatut = "en_attente" | "accepte" | "conteste" | "annule";

interface Row {
  id: string;
  restaurateur_id: string | null;
  restaurateur_nom: string;
  fournisseur_id: string;
  created_at: string;
  receptionnee_at: string | null;
  avoir_montant: number;
  avoir_statut: AvoirStatut;
  avoir_motif_contestation: string | null;
  avoir_arbitre_admin: boolean;
}

const CHIP: Record<AvoirStatut, { label: string; cls: string }> = {
  en_attente: { label: "En attente fournisseur", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  accepte:    { label: "Accepté",                cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  conteste:   { label: "Contesté — litige",      cls: "border-rose-200 bg-rose-50 text-rose-700" },
  annule:     { label: "Annulé par resto",       cls: "border-[var(--border)] bg-[var(--bg-subtle)] text-gray-600" },
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function AdminAvoirs() {
  const [rows, setRows]             = useState<Row[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [restoNames, setRestoNames] = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<"tous" | AvoirStatut | "litiges">("litiges");

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("commandes")
      .select(`
        id, restaurateur_id, restaurateur_nom, fournisseur_id, created_at, receptionnee_at,
        avoir_montant, avoir_statut, avoir_motif_contestation, avoir_arbitre_admin
      `)
      .not("avoir_statut", "is", null)
      .order("avoir_conteste_at", { ascending: false, nullsFirst: false })
      .order("receptionnee_at", { ascending: false, nullsFirst: false });

    const typed = (data ?? []) as Row[];
    setRows(typed);

    const fIds = Array.from(new Set(typed.map(r => r.fournisseur_id)));
    const rIds = Array.from(new Set(typed.map(r => r.restaurateur_id).filter((x): x is string => !!x)));
    const allIds = Array.from(new Set([...fIds, ...rIds]));
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nom_commercial, nom_etablissement, role").in("id", allIds);
      const fMap: Record<string, string> = {};
      const rMap: Record<string, string> = {};
      (profs ?? []).forEach(p => {
        const nom = p.nom_commercial || p.nom_etablissement || "—";
        if (p.role === "fournisseur")  fMap[p.id] = nom;
        if (p.role === "restaurateur") rMap[p.id] = nom;
      });
      setFournNames(fMap);
      setRestoNames(rMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = rows.filter(r => {
    if (filter === "tous")    return true;
    if (filter === "litiges") return r.avoir_statut === "conteste" && !r.avoir_arbitre_admin;
    return r.avoir_statut === filter;
  });

  async function arbitrer(id: string, decision: "accepte" | "annule") {
    const supabase = createClient();
    const patch: Record<string, unknown> = {
      avoir_statut: decision,
      avoir_arbitre_admin: true,
    };
    if (decision === "accepte") patch.avoir_accepte_at = new Date().toISOString();
    if (decision === "annule")  patch.avoir_annule_at  = new Date().toISOString();
    await supabase.from("commandes").update(patch).eq("id", id);
    fetchAll();
  }

  const counts = {
    litiges:    rows.filter(r => r.avoir_statut === "conteste" && !r.avoir_arbitre_admin).length,
    en_attente: rows.filter(r => r.avoir_statut === "en_attente").length,
    accepte:    rows.filter(r => r.avoir_statut === "accepte").length,
    conteste:   rows.filter(r => r.avoir_statut === "conteste").length,
    annule:     rows.filter(r => r.avoir_statut === "annule").length,
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/admin" className="hover:text-gray-600">Admin</Link>
          <span>/</span>
          <span className="text-gray-600">Avoirs</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text)]">Avoirs &amp; litiges</h1>
          <p className="mt-1 text-sm text-gray-500">
            {counts.litiges} litige{counts.litiges > 1 ? "s" : ""} en attente d&apos;arbitrage.
          </p>
        </div>

        {/* Filtres */}
        <div className="mb-5 flex flex-wrap gap-2">
          {([
            { id: "litiges",    label: `Litiges à arbitrer (${counts.litiges})` },
            { id: "en_attente", label: `En attente (${counts.en_attente})` },
            { id: "conteste",   label: `Contestés (${counts.conteste})` },
            { id: "accepte",    label: `Acceptés (${counts.accepte})` },
            { id: "annule",     label: `Annulés (${counts.annule})` },
            { id: "tous",       label: `Tous (${rows.length})` },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-[40px] rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === f.id
                  ? "bg-rose-500 text-white"
                  : "border border-[var(--border)] bg-white text-gray-500 hover:text-[var(--text)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--border)] bg-white py-20 text-center text-gray-500">
            Aucun avoir dans cette catégorie.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const isLitige = r.avoir_statut === "conteste" && !r.avoir_arbitre_admin;
              return (
                <div key={r.id} className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CHIP[r.avoir_statut].cls}`}>
                          {CHIP[r.avoir_statut].label}
                        </span>
                        {r.avoir_arbitre_admin && (
                          <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                            Arbitré admin
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm">
                        <Link href={r.restaurateur_id ? `/admin/users/${r.restaurateur_id}` : "#"} className="font-semibold text-[var(--text)] hover:text-[var(--accent)]">
                          {r.restaurateur_id ? (restoNames[r.restaurateur_id] ?? r.restaurateur_nom) : r.restaurateur_nom}
                        </Link>
                        <span className="text-gray-400"> réclame un avoir à </span>
                        <Link href={`/admin/users/${r.fournisseur_id}`} className="font-semibold text-[var(--text)] hover:text-[var(--accent)]">
                          {fournNames[r.fournisseur_id] ?? "—"}
                        </Link>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Cmd {r.id.slice(0, 8).toUpperCase()} · Livrée {r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—"}
                      </p>
                      {r.avoir_motif_contestation && (
                        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                            Motif de contestation
                          </p>
                          <p className="mt-1 text-sm text-rose-800">{r.avoir_motif_contestation}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Montant</p>
                      <p className="text-xl font-bold text-rose-600">{fmt(r.avoir_montant)}</p>
                    </div>
                  </div>

                  {isLitige && (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-3">
                      <button
                        onClick={() => regenerateAvoirPDF(r.id).catch(console.error)}
                        className="min-h-[40px] rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg-subtle)]"
                      >
                        ↓ PDF
                      </button>
                      <button
                        onClick={() => arbitrer(r.id, "annule")}
                        className="min-h-[40px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Arbitrer en faveur du fournisseur (annuler)
                      </button>
                      <button
                        onClick={() => arbitrer(r.id, "accepte")}
                        className="min-h-[40px] rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                      >
                        Arbitrer en faveur du resto (maintenir)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
