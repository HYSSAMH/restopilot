"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadRestaurateurData, montantNet, fmt, fournIdOf, type Commande } from "@/lib/gestion-data";

interface Row {
  id:            string;
  nom:           string;
  isInterne:     boolean;
  caTotal:       number;
  nbCommandes:   number;
  derniereCmd:   string;
  nbProduits:    number;
  totalPaye:     number;
  solde:         number;
  topProduit:    string;
}

export default function FournisseursPage() {
  const [rows, setRows]     = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const d = await loadRestaurateurData();
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Paiements effectués
      const { data: paiements } = user
        ? await supabase.from("paiements").select("restaurateur_id, fournisseur_id, montant")
          .eq("restaurateur_id", user.id)
        : { data: [] };

      type PayRow = { fournisseur_id: string; montant: number };
      const payeParFourn = new Map<string, number>();
      ((paiements ?? []) as PayRow[]).forEach(p => {
        payeParFourn.set(p.fournisseur_id, (payeParFourn.get(p.fournisseur_id) ?? 0) + Number(p.montant));
      });

      const agg = new Map<string, Row>();
      const produitsByF = new Map<string, Map<string, number>>(); // fournId → produit → valeur

      for (const c of d.commandes) {
        const fId = fournIdOf(c);
        if (!fId) continue;
        if (c.statut === "annulee") continue;

        if (!agg.has(fId)) {
          agg.set(fId, {
            id:           fId,
            nom:          d.fournNames[fId] ?? "—",
            isInterne:    !!c.fournisseur_id,
            caTotal:      0,
            nbCommandes:  0,
            derniereCmd:  c.created_at,
            nbProduits:   0,
            totalPaye:    0,
            solde:        0,
            topProduit:   "",
          });
          produitsByF.set(fId, new Map());
        }
        const r = agg.get(fId)!;
        r.nbCommandes += 1;
        r.caTotal     += montantNet(c);
        if (c.created_at > r.derniereCmd) r.derniereCmd = c.created_at;

        const pmap = produitsByF.get(fId)!;
        c.lignes_commande.forEach(l => {
          const valeur = Number(l.prix_snapshot) * Number(l.quantite);
          pmap.set(l.nom_snapshot, (pmap.get(l.nom_snapshot) ?? 0) + valeur);
        });
      }

      // Finalise
      const result: Row[] = [];
      agg.forEach((r, fId) => {
        r.totalPaye = payeParFourn.get(fId) ?? 0;
        r.solde     = Math.max(0, Math.round((r.caTotal - r.totalPaye) * 100) / 100);
        const pmap  = produitsByF.get(fId)!;
        r.nbProduits = pmap.size;
        let topNom = ""; let topVal = 0;
        pmap.forEach((v, nom) => { if (v > topVal) { topVal = v; topNom = nom; } });
        r.topProduit = topNom;
        result.push(r);
      });
      result.sort((a, b) => b.caTotal - a.caTotal);

      setRows(result);
      setLoading(false);
    })();
  }, []);

  const totalCA       = rows.reduce((s, r) => s + r.caTotal, 0);
  const totalSolde    = rows.reduce((s, r) => s + r.solde, 0);
  const fournAvecDette = rows.filter(r => r.solde > 0).length;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[18px] font-[650] tracking-[-0.01em] text-[var(--text)]">Tableau de bord fournisseurs</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Fournisseurs"       value={String(rows.length)} />
        <Kpi label="CA total (tous)"    value={fmt(totalCA)} />
        <Kpi label="Solde total"        value={fmt(totalSolde)} accent={totalSolde > 0 ? "rose" : "emerald"} />
        <Kpi label="Avec impayé"        value={String(fournAvecDette)} accent={fournAvecDette > 0 ? "rose" : undefined} />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
          Aucun fournisseur à afficher (vous n&apos;avez pas encore de commandes).
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left">Fournisseur</th>
                <th className="px-4 py-3 text-left">Top produit</th>
                <th className="px-4 py-3 text-right">Cmdes</th>
                <th className="px-4 py-3 text-right">Produits</th>
                <th className="px-4 py-3 text-left">Dernier achat</th>
                <th className="px-4 py-3 text-right">CA total</th>
                <th className="px-4 py-3 text-right">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#1A1A2E]">{r.nom}</span>
                      {!r.isInterne && (
                        <span className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600">externe</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[220px]">{r.topProduit || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.nbCommandes}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.nbProduits}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(r.derniereCmd).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#1A1A2E]">{fmt(r.caTotal)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${r.solde > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {fmt(r.solde)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "rose" | "emerald" }) {
  const cls = accent === "rose" ? "border-rose-200 bg-rose-50 text-rose-700"
            : accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-gray-200 bg-white text-[#1A1A2E]";
  return (
    <div className={`rounded-2xl border ${cls.split(" ").slice(0, 2).join(" ")} p-4 shadow-sm`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${cls.split(" ")[2]}`}>{value}</p>
    </div>
  );
}
