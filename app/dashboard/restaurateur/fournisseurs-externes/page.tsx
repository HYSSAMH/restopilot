"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";

interface Fourn {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  siret: string | null;
  invite_envoyee: string | null;
}
interface Stats {
  nbCommandes: number;
  caTotal:     number;
  derniere:    string | null;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function FournisseursExternes() {
  const [rows, setRows]       = useState<(Fourn & Stats)[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: fourns } = await supabase
      .from("fournisseurs_externes")
      .select("*")
      .eq("restaurateur_id", user.id)
      .order("created_at", { ascending: false });

    const { data: cmds } = await supabase
      .from("commandes")
      .select("fournisseur_externe_id, montant_total, created_at, statut")
      .eq("restaurateur_id", user.id)
      .not("fournisseur_externe_id", "is", null);

    type CmdRow = { fournisseur_externe_id: string; montant_total: number; created_at: string; statut: string };
    const statsMap = new Map<string, Stats>();
    ((cmds ?? []) as CmdRow[]).forEach(c => {
      const key = c.fournisseur_externe_id;
      if (!statsMap.has(key)) statsMap.set(key, { nbCommandes: 0, caTotal: 0, derniere: null });
      const s = statsMap.get(key)!;
      s.nbCommandes += 1;
      if (c.statut !== "annulee") s.caTotal += Number(c.montant_total);
      if (!s.derniere || c.created_at > s.derniere) s.derniere = c.created_at;
    });

    const merged = (fourns ?? []).map((f: Fourn) => ({
      ...f,
      ...(statsMap.get(f.id) ?? { nbCommandes: 0, caTotal: 0, derniere: null }),
    }));
    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function markInvited(id: string) {
    const supabase = createClient();
    await supabase.from("fournisseurs_externes").update({ invite_envoyee: new Date().toISOString() }).eq("id", id);
    fetchAll();
  }

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Fournisseurs externes</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Fournisseurs externes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fournisseurs détectés sur vos factures importées, non-inscrits sur RestoPilot.
          </p>
        </div>

        {loading ? (
          <div className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center">
            <span className="text-5xl">🏷️</span>
            <p className="mt-3 text-sm text-gray-500">
              Aucun fournisseur externe pour l&apos;instant.<br />
              Importez une facture sur{" "}
              <Link href="/dashboard/restaurateur/factures" className="text-indigo-500 hover:underline">Factures</Link>
              {" "}pour en créer automatiquement.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-[#1A1A2E]">{r.nom}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {[r.siret ? `SIRET ${r.siret}` : null, r.email, r.telephone].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {r.adresse && <p className="text-xs text-gray-500">{r.adresse}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.invite_envoyee ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        Invitation envoyée
                      </span>
                    ) : r.email ? (
                      <button
                        onClick={() => markInvited(r.id)}
                        className="min-h-[40px] rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        title="Marque l'invitation comme envoyée (l'envoi d'email nécessitera un SMTP côté serveur — pas encore branché)"
                      >
                        ✉ Inviter à rejoindre
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">(email absent)</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Commandes</p>
                    <p className="text-sm font-bold text-[#1A1A2E]">{r.nbCommandes}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Total</p>
                    <p className="text-sm font-bold text-[#1A1A2E]">{fmt(r.caTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Dernier</p>
                    <p className="text-sm font-bold text-[#1A1A2E]">
                      {r.derniere ? new Date(r.derniere).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
