"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";

interface Ligne {
  nom_snapshot: string;
  prix_snapshot: number;
  unite: string;
  quantite: number;
  date: string;
  fournisseur_id: string;
}

interface MonthStats {
  qte: number;
  valeur: number;
  prixMoyenPondere: number; // prix moyen pondéré par quantité
}

interface ProduitAgg {
  nom: string;
  unite: string;
  qteTotal: number;
  valeurTotal: number;
  prixMoyenTotal: number;
  qteMoisCourant: number;
  qteMoisPrec: number;
  deltaQtePct: number | null;       // null si mois précédent = 0
  prixMoisCourant: number | null;   // null si pas d'achat ce mois
  prixMoisPrec: number | null;
  deltaPrixPct: number | null;
  monthly: { ym: string; qte: number; valeur: number; prixMoyen: number }[]; // 12 derniers mois
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtQte(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ymLabel(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map(r => r.map(c => {
      const s = String(c);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type SortKey = "nom" | "qteTotal" | "valeurTotal" | "qteMoisCourant" | "deltaQtePct" | "deltaPrixPct";
type SortDir = "asc" | "desc";

export default function RapportsPage() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"30" | "90" | "365" | "all">("365");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valeurTotal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("commandes")
        .select(`
          fournisseur_id, fournisseur_externe_id, created_at, statut,
          lignes_commande ( nom_snapshot, prix_snapshot, unite, quantite )
        `)
        .eq("restaurateur_id", user.id)
        .neq("statut", "annulee")
        .order("created_at", { ascending: true })
        .limit(5000);

      const flat: Ligne[] = [];
      type Row = {
        fournisseur_id: string | null;
        fournisseur_externe_id: string | null;
        created_at: string;
        lignes_commande: { nom_snapshot: string; prix_snapshot: number; unite: string; quantite: number }[];
      };
      ((data ?? []) as Row[]).forEach((c) => {
        const fId = c.fournisseur_id ?? c.fournisseur_externe_id ?? "";
        c.lignes_commande.forEach(l => {
          flat.push({
            nom_snapshot:   l.nom_snapshot,
            prix_snapshot:  Number(l.prix_snapshot),
            unite:          l.unite,
            quantite:       Number(l.quantite),
            date:           c.created_at,
            fournisseur_id: fId,
          });
        });
      });
      setLignes(flat);

      const ids = Array.from(new Set(flat.map(l => l.fournisseur_id).filter(Boolean)));
      const map: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, nom_commercial, nom_etablissement").in("id", ids);
        (profs ?? []).forEach((p: { id: string; nom_commercial: string | null; nom_etablissement: string | null }) => {
          map[p.id] = p.nom_commercial || p.nom_etablissement || "—";
        });
        const { data: ext } = await supabase
          .from("fournisseurs_externes").select("id, nom").in("id", ids);
        (ext ?? []).forEach((e: { id: string; nom: string }) => {
          if (!map[e.id]) map[e.id] = `${e.nom} (externe)`;
        });
      }
      setFournNames(map);
      setLoading(false);
    })();
  }, []);

  // Période filtrée pour le tableau
  const filtered = useMemo(() => {
    if (period === "all") return lignes;
    const days = parseInt(period, 10);
    const ref = new Date();
    ref.setDate(ref.getDate() - days);
    const iso = ref.toISOString();
    return lignes.filter(l => l.date >= iso);
  }, [lignes, period]);

  // Mois courant et mois précédent (calendaire, par rapport à aujourd'hui)
  const moisCourant = useMemo(() => ymKey(new Date()), []);
  const moisPrec = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return ymKey(d);
  }, []);

  // Agrégation principale : un objet ProduitAgg par produit
  const produits: ProduitAgg[] = useMemo(() => {
    const byProd = new Map<string, Ligne[]>();
    filtered.forEach(l => {
      const key = l.nom_snapshot.toLowerCase().trim();
      if (!byProd.has(key)) byProd.set(key, []);
      byProd.get(key)!.push(l);
    });

    const result: ProduitAgg[] = [];
    for (const [, items] of byProd) {
      // Stats globales sur la période
      let qteTotal = 0, valeurTotal = 0;
      const moisMap = new Map<string, MonthStats>();
      for (const l of items) {
        const v = l.prix_snapshot * l.quantite;
        qteTotal += l.quantite;
        valeurTotal += v;
        const ym = ymKey(new Date(l.date));
        if (!moisMap.has(ym)) moisMap.set(ym, { qte: 0, valeur: 0, prixMoyenPondere: 0 });
        const m = moisMap.get(ym)!;
        m.qte += l.quantite;
        m.valeur += v;
      }
      // Calcule prix moyen pondéré par mois
      for (const m of moisMap.values()) {
        m.prixMoyenPondere = m.qte > 0 ? m.valeur / m.qte : 0;
      }

      const monthlyArr = Array.from(moisMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([ym, s]) => ({ ym, qte: s.qte, valeur: s.valeur, prixMoyen: s.prixMoyenPondere }));

      const cur = moisMap.get(moisCourant);
      const prec = moisMap.get(moisPrec);
      const qteMoisCourant = cur?.qte ?? 0;
      const qteMoisPrec = prec?.qte ?? 0;
      const deltaQtePct = qteMoisPrec > 0
        ? ((qteMoisCourant - qteMoisPrec) / qteMoisPrec) * 100
        : (qteMoisCourant > 0 ? 100 : null);

      const prixMoisCourant = cur?.qte ? cur.valeur / cur.qte : null;
      const prixMoisPrec = prec?.qte ? prec.valeur / prec.qte : null;
      const deltaPrixPct = prixMoisPrec != null && prixMoisCourant != null && prixMoisPrec > 0
        ? ((prixMoisCourant - prixMoisPrec) / prixMoisPrec) * 100
        : null;

      result.push({
        nom: items[0].nom_snapshot,
        unite: items[0].unite,
        qteTotal,
        valeurTotal,
        prixMoyenTotal: qteTotal > 0 ? valeurTotal / qteTotal : 0,
        qteMoisCourant,
        qteMoisPrec,
        deltaQtePct,
        prixMoisCourant,
        prixMoisPrec,
        deltaPrixPct,
        monthly: monthlyArr,
      });
    }
    return result;
  }, [filtered, moisCourant, moisPrec]);

  // Tri + recherche + pagination
  const sortedFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let arr = s ? produits.filter(p => p.nom.toLowerCase().includes(s)) : produits;
    arr = [...arr].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return sortDir === "asc" ? -1 : 1;
      if (vb == null) return sortDir === "asc" ? 1 : -1;
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
    return arr;
  }, [produits, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const paged = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function setSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        "Produit", "Unité", "Qté totale (période)", "Valeur totale", "Prix moyen",
        "Qté mois courant", "Qté mois précédent", "Δ qté %",
        "Prix mois courant", "Prix mois précédent", "Δ prix %",
      ],
      ...sortedFiltered.map(p => [
        p.nom, p.unite,
        p.qteTotal.toFixed(2), p.valeurTotal.toFixed(2), p.prixMoyenTotal.toFixed(2),
        p.qteMoisCourant.toFixed(2), p.qteMoisPrec.toFixed(2),
        p.deltaQtePct == null ? "" : p.deltaQtePct.toFixed(1),
        p.prixMoisCourant?.toFixed(2) ?? "",
        p.prixMoisPrec?.toFixed(2) ?? "",
        p.deltaPrixPct == null ? "" : p.deltaPrixPct.toFixed(1),
      ]),
    ];
    downloadCsv(`rapport-volume-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const selectedProduit = selected ? produits.find(p => p.nom.toLowerCase().trim() === selected.toLowerCase().trim()) : null;
  const occurrencesSelected = useMemo(() => {
    if (!selected) return [];
    const k = selected.toLowerCase().trim();
    return filtered
      .filter(l => l.nom_snapshot.toLowerCase().trim() === k)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered, selected]);

  return (
    <DashboardLayout role="restaurateur">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Rapports d&apos;achats</h1>
          <p className="page-sub">
            <span className="mono">{produits.length}</span> produit{produits.length > 1 ? "s" : ""} ·{" "}
            <span className="mono">{filtered.length}</span> ligne{filtered.length > 1 ? "s" : ""} sur la période.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={period}
            onChange={e => { setPeriod(e.target.value as typeof period); setPage(1); }}
            className="min-h-[44px] rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="365">12 derniers mois</option>
            <option value="all">Tout l&apos;historique</option>
          </select>
          <button
            onClick={exportCsv}
            disabled={sortedFiltered.length === 0}
            className="min-h-[44px] rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] hover:border-indigo-300 hover:text-[var(--accent)] disabled:opacity-50"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="mb-3">
        <input
          type="search"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Rechercher un produit…"
          className="w-full min-h-[44px] rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
      ) : produits.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--border)] bg-white py-20 text-center text-gray-500">
          Aucune commande sur la période sélectionnée.
        </div>
      ) : (
        <div className="rounded-[10px] border border-[var(--border)] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <Th sortable sortKey="nom" current={sortKey} dir={sortDir} onClick={setSort} className="text-left">Produit</Th>
                  <Th sortable sortKey="qteTotal" current={sortKey} dir={sortDir} onClick={setSort} className="text-right">Qté totale</Th>
                  <Th sortable sortKey="valeurTotal" current={sortKey} dir={sortDir} onClick={setSort} className="text-right">Valeur</Th>
                  <Th className="text-right">Prix moyen</Th>
                  <Th sortable sortKey="qteMoisCourant" current={sortKey} dir={sortDir} onClick={setSort} className="text-right">Qté mois</Th>
                  <Th sortable sortKey="deltaQtePct" current={sortKey} dir={sortDir} onClick={setSort} className="text-right">Δ qté</Th>
                  <Th sortable sortKey="deltaPrixPct" current={sortKey} dir={sortDir} onClick={setSort} className="text-right">Δ prix</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.map(p => (
                  <tr
                    key={p.nom}
                    onClick={() => setSelected(p.nom)}
                    className="cursor-pointer hover:bg-[var(--accent-soft)]/30"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--text)]">{p.nom}</div>
                      <div className="text-[11px] text-gray-500">{p.unite}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right mono tabular text-[var(--text)]">{fmtQte(p.qteTotal)}</td>
                    <td className="px-3 py-2.5 text-right mono tabular font-semibold text-[var(--text)]">{fmt(p.valeurTotal)}</td>
                    <td className="px-3 py-2.5 text-right mono tabular text-gray-600">{fmt(p.prixMoyenTotal)}</td>
                    <td className="px-3 py-2.5 text-right mono tabular text-[var(--text)]">{fmtQte(p.qteMoisCourant)}</td>
                    <td className="px-3 py-2.5 text-right"><Delta value={p.deltaQtePct} /></td>
                    <td className="px-3 py-2.5 text-right"><Delta value={p.deltaPrixPct} invert /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-gray-600">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedFiltered.length)} sur {sortedFiltered.length}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded px-2 py-1 hover:bg-white disabled:opacity-40">←</button>
                <span className="px-2 py-1">{page} / {pageCount}</span>
                <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded px-2 py-1 hover:bg-white disabled:opacity-40">→</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drill-down produit */}
      {selectedProduit && (
        <div className="mt-5 rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--text)]">{selectedProduit.nom}</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {fmtQte(selectedProduit.qteTotal)} {selectedProduit.unite} · {fmt(selectedProduit.valeurTotal)} sur la période ·
                prix moyen <span className="font-semibold text-[var(--text)]">{fmt(selectedProduit.prixMoyenTotal)}</span>
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:text-gray-700">Fermer ✕</button>
          </div>

          {/* Quantité par mois (12 derniers) */}
          <div className="mt-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Quantité achetée par mois</p>
            <MonthlyBars data={selectedProduit.monthly} />
          </div>

          {/* Détail mensuel : tableau */}
          <div className="mt-5 overflow-x-auto rounded-[8px] border border-[var(--border)]">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left">Mois</th>
                  <th className="px-3 py-2 text-right">Quantité</th>
                  <th className="px-3 py-2 text-right">Valeur</th>
                  <th className="px-3 py-2 text-right">Prix moyen</th>
                  <th className="px-3 py-2 text-right">Δ qté vs M-1</th>
                  <th className="px-3 py-2 text-right">Δ prix vs M-1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedProduit.monthly.map((m, i) => {
                  const prev = i > 0 ? selectedProduit.monthly[i - 1] : null;
                  const dQte = prev && prev.qte > 0 ? ((m.qte - prev.qte) / prev.qte) * 100 : null;
                  const dPrix = prev && prev.prixMoyen > 0 ? ((m.prixMoyen - prev.prixMoyen) / prev.prixMoyen) * 100 : null;
                  return (
                    <tr key={m.ym}>
                      <td className="px-3 py-2 text-[var(--text)]">{ymLabel(m.ym)}</td>
                      <td className="px-3 py-2 text-right mono tabular">{fmtQte(m.qte)}</td>
                      <td className="px-3 py-2 text-right mono tabular font-semibold">{fmt(m.valeur)}</td>
                      <td className="px-3 py-2 text-right mono tabular text-gray-600">{fmt(m.prixMoyen)}</td>
                      <td className="px-3 py-2 text-right"><Delta value={dQte} /></td>
                      <td className="px-3 py-2 text-right"><Delta value={dPrix} invert /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Historique d'achats */}
          <div className="mt-5 overflow-x-auto rounded-[8px] border border-[var(--border)]">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Fournisseur</th>
                  <th className="px-3 py-2 text-right">Qté</th>
                  <th className="px-3 py-2 text-right">Prix unit.</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {occurrencesSelected.slice(0, 50).map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-500 mono tabular">{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2 text-[var(--text)]">{fournNames[l.fournisseur_id] ?? "—"}</td>
                    <td className="px-3 py-2 text-right mono tabular">{fmtQte(l.quantite)}</td>
                    <td className="px-3 py-2 text-right mono tabular text-gray-600">{fmt(l.prix_snapshot)}</td>
                    <td className="px-3 py-2 text-right mono tabular font-semibold">{fmt(l.prix_snapshot * l.quantite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {occurrencesSelected.length > 50 && (
              <p className="border-t border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-gray-500">
                … +{occurrencesSelected.length - 50} achats plus anciens (export CSV pour la liste complète)
              </p>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Th({
  children, sortable, sortKey, current, dir, onClick, className,
}: {
  children: React.ReactNode;
  sortable?: boolean;
  sortKey?: SortKey;
  current?: SortKey;
  dir?: SortDir;
  onClick?: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = sortable && sortKey === current;
  return (
    <th className={`px-3 py-2 ${className ?? ""}`}>
      {sortable && sortKey ? (
        <button
          onClick={() => onClick?.(sortKey)}
          className={`flex items-center gap-1 ${className?.includes("text-right") ? "ml-auto" : ""} hover:text-[var(--accent)]`}
        >
          {children}
          {isActive && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
        </button>
      ) : children}
    </th>
  );
}

function Delta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  // invert = true : une hausse est négative (cas du prix qui augmente = mauvais)
  const isPositive = invert ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.5;
  const cls = isNeutral
    ? "text-gray-500"
    : isPositive
    ? "text-emerald-600"
    : "text-rose-600";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`mono tabular text-[12px] font-medium ${cls}`}>
      {sign}{value.toFixed(1)}%
    </span>
  );
}

function MonthlyBars({ data }: { data: { ym: string; qte: number; valeur: number; prixMoyen: number }[] }) {
  const max = Math.max(0, ...data.map(d => d.qte));
  if (max === 0 || data.length === 0) {
    return <p className="text-xs text-gray-500">Pas de données mensuelles.</p>;
  }
  return (
    <div className="flex items-end gap-1 h-32 border-b border-[var(--border)] pb-1">
      {data.map(d => {
        const pct = (d.qte / max) * 100;
        return (
          <div key={d.ym} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${ymLabel(d.ym)} : ${fmtQte(d.qte)}`}>
            <div className="flex-1 w-full flex items-end">
              <div
                className="w-full rounded-t bg-indigo-500 hover:bg-indigo-600 transition-colors"
                style={{ height: `${pct}%`, minHeight: pct > 0 ? "2px" : "0" }}
              />
            </div>
            <span className="text-[9px] text-gray-500 truncate w-full text-center">{ymLabel(d.ym)}</span>
          </div>
        );
      })}
    </div>
  );
}
