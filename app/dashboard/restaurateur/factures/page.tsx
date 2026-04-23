"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import type { StatutCommande } from "@/lib/supabase/types";
import { regenerateFacturePDF } from "@/lib/facture-from-db";
import FactureImportModal from "@/components/factures/FactureImportModal";
import { Pagination, paginate, PAGE_SIZE_DEFAULT } from "@/components/ui/Pagination";

interface Commande {
  id: string;
  fournisseur_id: string | null;
  fournisseur_externe_id: string | null;
  statut: StatutCommande;
  montant_total: number;
  avoir_montant: number | null;
  source: string | null;
  numero_facture_externe: string | null;
  pdf_path: string | null;
  created_at: string;
  lignes_commande: {
    id: string;
    nom_snapshot: string;
    prix_snapshot: number;
    unite: string;
    quantite: number;
  }[];
}

interface LignesByProduit {
  nom: string;
  totalQte: number;
  totalValeur: number;
  occurrences: { fournisseurId: string; fournisseurNom: string; prix: number; qte: number; date: string }[];
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const STATUT_CHIP: Record<StatutCommande, { label: string; cls: string }> = {
  recue:                       { label: "Reçue",             cls: "border-amber-200 bg-amber-50 text-amber-700" },
  en_preparation:              { label: "En préparation",    cls: "border-blue-200 bg-blue-50 text-blue-700" },
  en_livraison:                { label: "En livraison",      cls: "border-violet-200 bg-violet-50 text-violet-700" },
  livree:                      { label: "Livrée",            cls: "border-sky-200 bg-sky-50 text-sky-700" },
  receptionnee:                { label: "Réceptionnée",      cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  receptionnee_avec_anomalies: { label: "Récep. anomalies",  cls: "border-rose-200 bg-rose-50 text-rose-700" },
  annulee:                     { label: "Annulée",           cls: "border-red-200 bg-red-50 text-red-700" },
};

export default function FacturesPage() {
  const [tab, setTab] = useState<"factures" | "produits">("factures");
  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [cheaperAlerts, setCheaperAlerts] = useState<Record<string, { fournNom: string; prix: number }>>({});
  const [loading, setLoading]       = useState(true);
  const [downloading, setDL]        = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [reloadKey, setReloadKey]   = useState(0);

  // Filtres factures
  const [search, setSearch] = useState("");
  const [fournFilter, setFournFilter] = useState<"tous" | string>("tous");
  const [dateFrom, setDateFrom]       = useState<string>("");
  const [dateTo, setDateTo]           = useState<string>("");
  const [montantMin, setMontantMin]   = useState<string>("");
  const [montantMax, setMontantMax]   = useState<string>("");
  const [page, setPage]               = useState(1);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("commandes")
        .select(`
          id, fournisseur_id, fournisseur_externe_id, statut, montant_total, avoir_montant,
          source, numero_facture_externe, pdf_path, created_at,
          lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite )
        `)
        .eq("restaurateur_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      const typed = (data ?? []) as unknown as Commande[];
      setCommandes(typed);

      // Fournisseurs internes (profiles) + externes → noms affichés
      const fIds = Array.from(new Set(typed.map(c => c.fournisseur_id).filter((x): x is string => !!x)));
      const fExtIds = Array.from(new Set(typed.map(c => c.fournisseur_externe_id).filter((x): x is string => !!x)));
      const map: Record<string, string> = {};
      if (fIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, nom_commercial, nom_etablissement").in("id", fIds);
        (profs ?? []).forEach(p => { map[p.id] = p.nom_commercial || p.nom_etablissement || "—"; });
      }
      if (fExtIds.length > 0) {
        const { data: ext } = await supabase
          .from("fournisseurs_externes").select("id, nom").in("id", fExtIds);
        (ext ?? []).forEach(e => { map[e.id] = `${e.nom} (externe)`; });
      }
      setFournNames(map);

      // Alertes "disponible moins cher" : compare chaque nom de produit acheté
      // avec les tarifs actifs du catalogue RestoPilot et le dernier prix payé.
      const nomProduits = Array.from(new Set(
        typed.flatMap(c => c.lignes_commande.map(l => l.nom_snapshot.toLowerCase().trim())),
      ));
      if (nomProduits.length > 0) {
        const { data: tarifs } = await supabase
          .from("tarifs")
          .select("prix, unite, fournisseur_id, produits!inner ( nom )")
          .eq("actif", true).is("archived_at", null);
        type TarifRow = {
          prix: number; unite: string; fournisseur_id: string;
          produits: { nom: string };
        };
        const tarifsMap = new Map<string, { fournId: string; prix: number }[]>();
        ((tarifs ?? []) as unknown as TarifRow[]).forEach(t => {
          const key = t.produits.nom.toLowerCase().trim();
          if (!tarifsMap.has(key)) tarifsMap.set(key, []);
          tarifsMap.get(key)!.push({ fournId: t.fournisseur_id, prix: Number(t.prix) });
        });
        // Dernier prix payé par produit
        const dernierPrixPaye = new Map<string, number>();
        typed.slice().reverse().forEach(c => {
          c.lignes_commande.forEach(l => {
            dernierPrixPaye.set(l.nom_snapshot.toLowerCase().trim(), Number(l.prix_snapshot));
          });
        });
        const alerts: Record<string, { fournNom: string; prix: number }> = {};
        for (const [nom, paye] of dernierPrixPaye.entries()) {
          const candidats = tarifsMap.get(nom);
          if (!candidats) continue;
          const meilleur = candidats.reduce((m, c) => c.prix < m.prix ? c : m, candidats[0]);
          if (meilleur.prix < paye) {
            alerts[nom] = { fournNom: map[meilleur.fournId] ?? "—", prix: meilleur.prix };
          }
        }
        setCheaperAlerts(alerts);
      }

      setLoading(false);
    })();
  }, [reloadKey]);

  const filtered = useMemo(() => {
    let arr = commandes;
    if (fournFilter !== "tous") arr = arr.filter(c => (c.fournisseur_id ?? c.fournisseur_externe_id) === fournFilter);
    if (dateFrom) arr = arr.filter(c => c.created_at.slice(0, 10) >= dateFrom);
    if (dateTo)   arr = arr.filter(c => c.created_at.slice(0, 10) <= dateTo);
    const min = parseFloat(montantMin);
    if (!isNaN(min) && min > 0) arr = arr.filter(c => Number(c.montant_total) >= min);
    const max = parseFloat(montantMax);
    if (!isNaN(max) && max > 0) arr = arr.filter(c => Number(c.montant_total) <= max);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(c => {
        const nom = (fournNames[c.fournisseur_id ?? c.fournisseur_externe_id ?? ""] ?? "").toLowerCase();
        const num = (c.numero_facture_externe ?? "").toLowerCase();
        return nom.includes(s) || num.includes(s) || c.id.toLowerCase().startsWith(s);
      });
    }
    return arr;
  }, [commandes, fournFilter, dateFrom, dateTo, montantMin, montantMax, search, fournNames]);

  useEffect(() => { setPage(1); }, [fournFilter, dateFrom, dateTo, montantMin, montantMax, search]);

  const fournUniques = Array.from(new Set(commandes.map(c => c.fournisseur_id ?? c.fournisseur_externe_id).filter((x): x is string => !!x)));
  const totalFiltre = filtered.filter(c => c.statut !== "annulee").reduce((s, c) => s + Number(c.montant_total), 0);

  // Vue par produit
  const parProduit: LignesByProduit[] = useMemo(() => {
    const map = new Map<string, LignesByProduit>();
    filtered.forEach(c => {
      const fournNom = fournNames[c.fournisseur_id ?? c.fournisseur_externe_id ?? ""] ?? "—";
      c.lignes_commande.forEach(l => {
        const key = l.nom_snapshot.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { nom: l.nom_snapshot, totalQte: 0, totalValeur: 0, occurrences: [] });
        }
        const p = map.get(key)!;
        p.totalQte    += Number(l.quantite);
        p.totalValeur += Number(l.quantite) * Number(l.prix_snapshot);
        p.occurrences.push({
          fournisseurId:  c.fournisseur_id ?? c.fournisseur_externe_id ?? "",
          fournisseurNom: fournNom,
          prix:           Number(l.prix_snapshot),
          qte:            Number(l.quantite),
          date:           c.created_at,
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.totalValeur - a.totalValeur);
  }, [filtered, fournNames]);

  async function download(id: string) {
    setDL(id);
    try { await regenerateFacturePDF(id); }
    catch (e) { console.error(e); alert("Erreur lors de la génération du PDF."); }
    setDL(null);
  }

  /** Ouvre le PDF original d'une facture importée dans un nouvel onglet. */
  async function viewOriginal(pdfPath: string) {
    const supa = createClient();
    const { data, error } = await supa.storage.from("factures-externes")
      .createSignedUrl(pdfPath, 300);
    if (error || !data) { alert("Impossible d'ouvrir le PDF : " + (error?.message ?? "inconnu")); return; }
    window.open(data.signedUrl, "_blank");
  }

  /** Télécharge le PDF original d'une facture importée. */
  async function downloadOriginal(pdfPath: string) {
    const supa = createClient();
    const { data, error } = await supa.storage.from("factures-externes")
      .createSignedUrl(pdfPath, 300, { download: true });
    if (error || !data) { alert("Impossible de télécharger : " + (error?.message ?? "inconnu")); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.click();
  }

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600">Factures</span>
        </div>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A2E]">Factures &amp; historique</h1>
            <p className="mt-1 text-sm text-gray-500">
              {commandes.length} facture{commandes.length > 1 ? "s" : ""} au total.
            </p>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            <span>📄</span>
            <span>Importer une facture</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit">
          {([
            { id: "factures", label: "Factures" },
            { id: "produits", label: "Par produit" },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-indigo-500 text-white" : "text-gray-500 hover:text-[#1A1A2E]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filtres (communs aux 2 onglets) */}
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 N° facture, fournisseur, id…"
            className="flex-1 min-w-48 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          <select value={fournFilter} onChange={e => setFournFilter(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-indigo-500">
            <option value="tous">Tous fournisseurs</option>
            {fournUniques.map(id => (
              <option key={id} value={id}>{fournNames[id] ?? id.slice(0, 6)}</option>
            ))}
          </select>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-gray-500">Du</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined}
                   className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-gray-500">Au</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || undefined}
                   className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-gray-500">Min €</span>
            <input type="number" min="0" step="0.01" value={montantMin} onChange={e => setMontantMin(e.target.value)} placeholder="0"
                   className="min-h-[40px] w-24 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-gray-500">Max €</span>
            <input type="number" min="0" step="0.01" value={montantMax} onChange={e => setMontantMax(e.target.value)} placeholder="∞"
                   className="min-h-[40px] w-24 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm" />
          </label>
          {(search || fournFilter !== "tous" || dateFrom || dateTo || montantMin || montantMax) && (
            <button onClick={() => { setSearch(""); setFournFilter("tous"); setDateFrom(""); setDateTo(""); setMontantMin(""); setMontantMax(""); }}
                    className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-600 hover:border-indigo-300">
              Réinitialiser
            </button>
          )}
        </div>

        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600">
          Total affiché (hors annulées) : <span className="font-semibold text-[#1A1A2E]">{fmt(totalFiltre)}</span>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : tab === "factures" ? (
          filtered.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
              Aucune facture ne correspond.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Fournisseur</th>
                    <th className="px-5 py-3 text-left">Statut</th>
                    <th className="px-5 py-3 text-right">Montant HT</th>
                    <th className="px-5 py-3 text-right">TTC (TVA 10%)</th>
                    <th className="px-5 py-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginate(filtered, page, PAGE_SIZE_DEFAULT).map((c, i) => {
                    const ttc = Number(c.montant_total) * 1.10;
                    const chip = STATUT_CHIP[c.statut];
                    return (
                      <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-5 py-3 text-gray-500">
                          {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3 font-medium text-[#1A1A2E]">{fournNames[c.fournisseur_id ?? c.fournisseur_externe_id ?? ""] ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                            {chip.label}
                          </span>
                          {Number(c.avoir_montant) > 0 && (
                            <span className="ml-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                              Avoir {fmt(Number(c.avoir_montant))}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-[#1A1A2E]">{fmt(c.montant_total)}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{fmt(ttc)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {c.source === "import" && c.pdf_path ? (
                              <>
                                <button
                                  onClick={() => viewOriginal(c.pdf_path!)}
                                  className="min-h-[36px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600"
                                  title="Consulter le PDF original"
                                >
                                  👁️ Consulter
                                </button>
                                <button
                                  onClick={() => downloadOriginal(c.pdf_path!)}
                                  className="min-h-[36px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600"
                                  title="Télécharger le PDF original"
                                >
                                  ⬇️ Télécharger
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => download(c.id)}
                                disabled={downloading === c.id}
                                className="min-h-[36px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
                              >
                                {downloading === c.id ? "…" : "↓ Générer PDF"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} total={filtered.length} onChange={setPage} />
            </div>
          )
        ) : (
          parProduit.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-gray-500">
              Aucune ligne d&apos;achat dans la période.
            </div>
          ) : (
            <div className="space-y-3">
              {parProduit.map((p) => {
                const alert = cheaperAlerts[p.nom.toLowerCase().trim()];
                const dernierPrix = p.occurrences[p.occurrences.length - 1]?.prix ?? 0;
                const economie = alert ? (dernierPrix - alert.prix) : 0;
                return (
                <details key={p.nom} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between p-4 list-none">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-[#1A1A2E]">{p.nom}</p>
                        {alert && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            🏷 Disponible à {fmt(alert.prix)} chez {alert.fournNom} · économie {fmt(economie)}/u
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {p.occurrences.length} achat{p.occurrences.length > 1 ? "s" : ""} · {p.totalQte} unités · {fmt(p.totalValeur)}
                      </p>
                    </div>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="border-t border-gray-200 bg-gray-50 p-3">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead>
                          <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Fournisseur</th>
                            <th className="px-3 py-2 text-right">Qté</th>
                            <th className="px-3 py-2 text-right">Prix unit.</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {p.occurrences.map((o, i) => (
                            <tr key={i} className="text-[#1A1A2E]">
                              <td className="px-3 py-2 text-gray-500">
                                {new Date(o.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                              </td>
                              <td className="px-3 py-2">{o.fournisseurNom}</td>
                              <td className="px-3 py-2 text-right">{o.qte}</td>
                              <td className="px-3 py-2 text-right">{fmt(o.prix)}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(o.prix * o.qte)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              );
              })}
            </div>
          )
        )}
      </div>

      {importOpen && (
        <FactureImportModal
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            setReloadKey(k => k + 1);
          }}
        />
      )}
    </DashboardLayout>
  );
}
