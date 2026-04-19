"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";

interface Commande {
  id: string;
  restaurateur_id: string | null;
  restaurateur_nom: string;
  statut: string;
  montant_total: number;
  avoir_montant: number | null;
  avoir_statut: string | null;
  created_at: string;
  receptionnee_at: string | null;
}

interface Paiement {
  restaurateur_id: string | null;
  montant: number;
}

interface Cond {
  restaurateur_id: string;
  delai_paiement_jours: number | null;
}

interface Profil {
  id: string;
  nom_commercial: string | null;
  nom_etablissement: string | null;
  telephone: string | null;
  adresse_ligne1: string | null;
  code_postal: string | null;
  ville: string | null;
}

interface ClientRow {
  id: string;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  premiereCommande: string;
  derniereCommande: string;
  nbCommandes: number;
  caTotal: number;
  totalPaye: number;
  solde: number;
  statut: "actif" | "inactif" | "en_retard";
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function ClientsList() {
  const [rows, setRows]       = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [statutFilter, setStatutFilter] = useState<"tous" | "actif" | "inactif" | "en_retard">("tous");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Toutes les commandes du fournisseur
      const { data: cmds } = await supabase
        .from("commandes")
        .select("id, restaurateur_id, restaurateur_nom, statut, montant_total, avoir_montant, avoir_statut, created_at, receptionnee_at")
        .eq("fournisseur_id", user.id);

      const { data: pays } = await supabase
        .from("paiements")
        .select("restaurateur_id, montant")
        .eq("fournisseur_id", user.id);

      const { data: conds } = await supabase
        .from("clients_fournisseur")
        .select("restaurateur_id, delai_paiement_jours")
        .eq("fournisseur_id", user.id);

      const commandes = (cmds ?? []) as Commande[];
      const paiements = (pays ?? []) as Paiement[];
      const condMap   = new Map<string, number>((conds ?? []).map((c: Cond) => [c.restaurateur_id, c.delai_paiement_jours ?? 30]));

      // IDs restaurateurs distincts
      const restoIds = Array.from(new Set(commandes.map(c => c.restaurateur_id).filter((x): x is string => !!x)));
      const profilsMap = new Map<string, Profil>();
      if (restoIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nom_commercial, nom_etablissement, telephone, adresse_ligne1, code_postal, ville")
          .in("id", restoIds);
        (profs ?? []).forEach(p => profilsMap.set(p.id, p as Profil));
      }

      // Agrégation
      const now = Date.now();
      const aggr = new Map<string, ClientRow>();

      commandes.forEach(c => {
        const id = c.restaurateur_id;
        if (!id) return;
        const p = profilsMap.get(id);
        const nom = p?.nom_commercial || p?.nom_etablissement || c.restaurateur_nom;
        const adr = [p?.adresse_ligne1, [p?.code_postal, p?.ville].filter(Boolean).join(" ")]
                      .filter(Boolean).join(" · ") || null;

        if (!aggr.has(id)) {
          aggr.set(id, {
            id,
            nom,
            telephone:        p?.telephone ?? null,
            adresse:          adr,
            premiereCommande: c.created_at,
            derniereCommande: c.created_at,
            nbCommandes:      0,
            caTotal:          0,
            totalPaye:        0,
            solde:            0,
            statut:           "actif",
          });
        }
        const row = aggr.get(id)!;
        row.nbCommandes += 1;
        if (c.created_at < row.premiereCommande) row.premiereCommande = c.created_at;
        if (c.created_at > row.derniereCommande) row.derniereCommande = c.created_at;

        // CA net = montant - avoirs acceptés (ou annulée = 0)
        if (c.statut !== "annulee") {
          const avoirDeduit = (c.avoir_statut === "accepte") ? Number(c.avoir_montant ?? 0) : 0;
          row.caTotal += Number(c.montant_total) - avoirDeduit;
        }
      });

      // Paiements
      paiements.forEach(p => {
        if (!p.restaurateur_id) return;
        const row = aggr.get(p.restaurateur_id);
        if (row) row.totalPaye += Number(p.montant);
      });

      // Solde + statut
      const result: ClientRow[] = [];
      aggr.forEach(row => {
        row.solde = Math.max(0, Math.round((row.caTotal - row.totalPaye) * 100) / 100);
        const derniere = new Date(row.derniereCommande).getTime();
        const diffDays = (now - derniere) / (1000 * 3600 * 24);
        const delai = condMap.get(row.id) ?? 30;
        if (row.solde > 0 && diffDays > delai) row.statut = "en_retard";
        else if (diffDays > 60)                row.statut = "inactif";
        else                                   row.statut = "actif";
        result.push(row);
      });

      result.sort((a, b) => b.derniereCommande.localeCompare(a.derniereCommande));
      setRows(result);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let arr = rows;
    if (statutFilter !== "tous") arr = arr.filter(r => r.statut === statutFilter);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(r => r.nom.toLowerCase().includes(s));
    }
    return arr;
  }, [rows, statutFilter, search]);

  const counts = {
    tous:      rows.length,
    actif:     rows.filter(r => r.statut === "actif").length,
    inactif:   rows.filter(r => r.statut === "inactif").length,
    en_retard: rows.filter(r => r.statut === "en_retard").length,
  };
  const totalCreances = rows.filter(r => r.statut === "en_retard").reduce((s, r) => s + r.solde, 0);

  return (
    <DashboardLayout role="fournisseur">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/fournisseur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Clients</span>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">Mes clients</h1>
            <p className="mt-1 text-sm text-gray-500">
              {rows.length} client{rows.length > 1 ? "s" : ""} au total.
            </p>
          </div>
          {totalCreances > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Créances en retard</p>
              <p className="text-lg font-bold text-rose-700">{fmt(totalCreances)}</p>
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un client"
            className="flex-1 min-w-48 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
            {([
              { id: "tous",      label: `Tous (${counts.tous})` },
              { id: "actif",     label: `Actifs (${counts.actif})` },
              { id: "inactif",   label: `Inactifs (${counts.inactif})` },
              { id: "en_retard", label: `En retard (${counts.en_retard})` },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setStatutFilter(f.id)}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium ${
                  statutFilter === f.id ? "bg-indigo-500 text-white" : "text-gray-500 hover:text-[#1A1A2E]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
            {rows.length === 0 ? "Aucun client n'a encore commandé chez vous." : "Aucun client ne correspond."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3 text-left">Client</th>
                  <th className="px-5 py-3 text-left">Contact</th>
                  <th className="px-5 py-3 text-left">Dernière cmd</th>
                  <th className="px-5 py-3 text-right">CA total</th>
                  <th className="px-5 py-3 text-right">Solde</th>
                  <th className="px-5 py-3 text-center">Statut</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#1A1A2E]">{r.nom}</p>
                      <p className="text-[11px] text-gray-500">{r.nbCommandes} commande{r.nbCommandes > 1 ? "s" : ""} · 1re le {formatDate(r.premiereCommande)}</p>
                    </td>
                    <td className="px-5 py-3">
                      {r.telephone && <p className="text-gray-700">{r.telephone}</p>}
                      {r.adresse && <p className="truncate text-[11px] text-gray-500">{r.adresse}</p>}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(r.derniereCommande)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[#1A1A2E]">{fmt(r.caTotal)}</td>
                    <td className={`px-5 py-3 text-right font-semibold ${r.solde > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {fmt(r.solde)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatutChip statut={r.statut} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/fournisseur/clients/${r.id}`}
                        className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600"
                      >
                        Fiche →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatutChip({ statut }: { statut: "actif" | "inactif" | "en_retard" }) {
  const cfg = {
    actif:     { label: "Actif",         cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    inactif:   { label: "Inactif",       cls: "border-gray-200 bg-gray-50 text-gray-600" },
    en_retard: { label: "En retard",     cls: "border-rose-200 bg-rose-50 text-rose-700" },
  }[statut];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
