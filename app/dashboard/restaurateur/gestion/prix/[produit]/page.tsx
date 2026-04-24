"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Dot, ReferenceDot,
} from "recharts";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { loadRestaurateurData, fmt, fournIdOf, type Commande } from "@/lib/gestion-data";

interface Achat {
  date:     string;       // ISO
  dateStr:  string;       // "15 avr."
  prix:     number;
  quantite: number;
  unite:    string;
  fournId:  string;
  fournNom: string;
  cmdId:    string;
}
interface Alt {
  fournId:  string;
  fournNom: string;
  prix:     number;
  unite:    string;
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
}
function formatLong(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PrixProduitPage({ params }: { params: Promise<{ produit: string }> }) {
  const { produit: produitParam } = use(params);
  const produitNom = decodeURIComponent(produitParam);

  const [commandes, setCommandes]   = useState<Commande[]>([]);
  const [fournNames, setFournNames] = useState<Record<string, string>>({});
  const [alternatives, setAlts]     = useState<Alt[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      const d = await loadRestaurateurData();
      setCommandes(d.commandes);
      setFournNames(d.fournNames);

      // Alternatives depuis tarifs actifs
      try {
        const supabase = createClient();
        const { data: tarifs } = await supabase
          .from("tarifs")
          .select("prix, unite, fournisseur_id, produits!inner ( nom )")
          .eq("actif", true).is("archived_at", null);
        type Row = { prix: number; unite: string; fournisseur_id: string; produits: { nom: string } };
        const k = produitNom.toLowerCase().trim();
        const matches = ((tarifs ?? []) as unknown as Row[])
          .filter(t => t.produits.nom.toLowerCase().trim() === k)
          .map(t => ({ fournId: t.fournisseur_id, fournNom: "", prix: Number(t.prix), unite: t.unite }));
        if (matches.length > 0) {
          const ids = Array.from(new Set(matches.map(m => m.fournId)));
          const { data: profs } = await supabase
            .from("profiles").select("id, nom_commercial, nom_etablissement").in("id", ids);
          const map: Record<string, string> = {};
          (profs ?? []).forEach(p => { map[p.id] = p.nom_commercial || p.nom_etablissement || "—"; });
          matches.forEach(m => m.fournNom = map[m.fournId] ?? "Fournisseur");
          matches.sort((a, b) => a.prix - b.prix);
          setAlts(matches);
        }
      } catch (e) { console.warn("[prix/detail] catalogue :", e); }

      setLoading(false);
    })();
  }, [produitNom]);

  // Flatten achats pour ce produit
  const achats: Achat[] = useMemo(() => {
    const out: Achat[] = [];
    const k = produitNom.toLowerCase().trim();
    for (const c of commandes) {
      if (c.statut === "annulee") continue;
      for (const l of c.lignes_commande) {
        if (l.nom_snapshot.toLowerCase().trim() !== k) continue;
        const fId = fournIdOf(c);
        out.push({
          date:     c.created_at,
          dateStr:  formatShort(c.created_at),
          prix:     Number(l.prix_snapshot),
          quantite: Number(l.quantite),
          unite:    l.unite,
          fournId:  fId,
          fournNom: fournNames[fId] ?? "—",
          cmdId:    c.id,
        });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [commandes, fournNames, produitNom]);

  // Stats
  const prix = achats.map(a => a.prix);
  const prixMin   = prix.length > 0 ? Math.min(...prix) : 0;
  const prixMax   = prix.length > 0 ? Math.max(...prix) : 0;
  const prixMoyen = prix.length > 0 ? prix.reduce((s, v) => s + v, 0) / prix.length : 0;
  const dernier   = achats[achats.length - 1];
  const avant     = achats[achats.length - 2];
  const evolPct   = dernier && avant && avant.prix > 0
                      ? ((dernier.prix - avant.prix) / avant.prix) * 100 : 0;

  // Identifie la plus grosse hausse (en %) entre deux achats consécutifs
  const biggestHike = useMemo(() => {
    let best = { pct: 0, index: -1 };
    for (let i = 1; i < achats.length; i++) {
      const prev = achats[i - 1].prix;
      if (prev <= 0) continue;
      const p = ((achats[i].prix - prev) / prev) * 100;
      if (p > best.pct) best = { pct: p, index: i };
    }
    return best.index >= 0 && best.pct > 0 ? best : null;
  }, [achats]);

  // Commander ce produit : lien vers le catalogue avec recherche préremplie
  const ordrerUrl = `/dashboard/restaurateur/commandes?q=${encodeURIComponent(produitNom)}`;

  return (
    <DashboardLayout role="restaurateur">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/dashboard/restaurateur" className="hover:text-gray-600">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/restaurateur/gestion" className="hover:text-gray-600">Gestion</Link>
          <span>/</span>
          <Link href="/dashboard/restaurateur/gestion/prix" className="hover:text-gray-600">Analyse prix</Link>
          <span>/</span>
          <span className="truncate text-gray-600">{produitNom}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">{produitNom}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {dernier
                ? <>Dernier achat chez <span className="font-medium text-[var(--text)]">{dernier.fournNom}</span> le {formatShort(dernier.date)}</>
                : "Aucun achat trouvé"}
            </p>
          </div>
          <Link
            href={ordrerUrl}
            className="flex min-h-[44px] items-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[var(--accent-hover)]"
          >
            🛒 Commander ce produit
          </Link>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
        ) : achats.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--border)] bg-white py-20 text-center text-gray-500">
            Aucun achat enregistré pour <span className="font-semibold">{produitNom}</span>.
            <br />
            <Link href="/dashboard/restaurateur/gestion/prix" className="mt-3 inline-block text-[var(--accent)] hover:underline">
              ← Retour à l&apos;analyse
            </Link>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Dernier prix"   value={fmt(dernier.prix)} />
              <Kpi label="Variation"
                   value={achats.length < 2 ? "—" : `${evolPct >= 0 ? "+" : ""}${evolPct.toFixed(1)}%`}
                   accent={evolPct > 10 ? "rose" : evolPct < -5 ? "emerald" : undefined} />
              <Kpi label="Prix min"       value={fmt(prixMin)} accent="emerald" />
              <Kpi label="Prix max"       value={fmt(prixMax)} accent="rose" />
              <Kpi label="Prix moyen"     value={fmt(prixMoyen)} />
            </div>

            {/* Graphique */}
            <div className="mb-5 rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Évolution du prix</h2>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={achats.map((a, i) => ({ ...a, idx: i }))} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8EC" />
                    <XAxis dataKey="dateStr" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#6B7280" }}
                           tickFormatter={(v) => `${v} €`} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 12 }}
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const a = payload[0].payload as Achat;
                        return (
                          <div className="rounded-lg border border-[var(--border)] bg-white p-3 text-xs shadow-md">
                            <p className="font-semibold text-[var(--text)]">{formatLong(a.date)}</p>
                            <p className="mt-1 text-gray-600">Fournisseur : {a.fournNom}</p>
                            <p className="text-gray-600">Qté : {a.quantite} {a.unite}</p>
                            <p className="mt-1 font-bold text-[var(--text)]">{fmt(a.prix)} / {a.unite}</p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="prix"
                      stroke="#6366F1"
                      strokeWidth={2}
                      dot={(props) => {
                        const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                        const isHike = biggestHike?.index === index;
                        return (
                          <Dot
                            cx={cx} cy={cy}
                            r={isHike ? 6 : 3}
                            fill={isHike ? "#E11D48" : "#6366F1"}
                            stroke="#fff" strokeWidth={isHike ? 2 : 1}
                          />
                        );
                      }}
                    />
                    {biggestHike && (
                      <ReferenceDot
                        x={achats[biggestHike.index].dateStr}
                        y={achats[biggestHike.index].prix}
                        r={10}
                        fill="transparent"
                        stroke="#E11D48"
                        strokeWidth={2}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {biggestHike && (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  ⚠ Hausse la plus importante : <span className="font-semibold">+{biggestHike.pct.toFixed(1)}%</span> le{" "}
                  <span className="font-semibold">{formatLong(achats[biggestHike.index].date)}</span>
                  {" "}(passage de {fmt(achats[biggestHike.index - 1].prix)} à {fmt(achats[biggestHike.index].prix)}).
                </p>
              )}
            </div>

            {/* Comparaison catalogue */}
            {alternatives.length > 0 && (
              <div className="mb-5 rounded-[10px] border border-emerald-200 bg-emerald-50 p-5">
                <h2 className="mb-2 text-sm font-semibold text-emerald-800">
                  Disponible chez {alternatives.length} fournisseur{alternatives.length > 1 ? "s" : ""} sur RestoPilot
                </h2>
                <div className="space-y-2">
                  {alternatives.slice(0, 5).map((a, i) => {
                    const cheaper = dernier && a.prix < dernier.prix;
                    const ecart   = dernier ? dernier.prix - a.prix : 0;
                    return (
                      <div key={a.fournId + i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                        <span className="font-medium text-[var(--text)]">{a.fournNom}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${cheaper ? "text-emerald-600" : "text-gray-700"}`}>
                            {fmt(a.prix)} / {a.unite}
                          </span>
                          {cheaper && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              −{fmt(ecart)}/u
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Link
                  href={ordrerUrl}
                  className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  → Voir dans le catalogue
                </Link>
              </div>
            )}

            {/* Table chronologique */}
            <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Fournisseur</th>
                    <th className="px-4 py-3 text-right">Quantité</th>
                    <th className="px-4 py-3 text-right">Prix unit.</th>
                    <th className="px-4 py-3 text-right">Variation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {achats.map((a, i) => {
                    const prev = i > 0 ? achats[i - 1] : null;
                    const variation = prev && prev.prix > 0 ? ((a.prix - prev.prix) / prev.prix) * 100 : null;
                    const isBiggest = biggestHike?.index === i;
                    return (
                      <tr key={i}
                          className={isBiggest
                            ? "bg-rose-50"
                            : i % 2 === 0 ? "bg-white" : "bg-[var(--bg-subtle)]"}>
                        <td className="px-4 py-2.5 text-gray-600">{formatLong(a.date)}</td>
                        <td className="px-4 py-2.5 text-[var(--text)]">{a.fournNom}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{a.quantite} {a.unite}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[var(--text)]">{fmt(a.prix)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {variation === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              variation > 10     ? "bg-rose-100 text-rose-700" :
                              variation > 0      ? "bg-amber-100 text-amber-700" :
                              variation < -5     ? "bg-emerald-100 text-emerald-700" :
                              "bg-[var(--bg-subtle)] text-gray-500"
                            }`}>
                              {variation > 0 ? "↑" : variation < 0 ? "↓" : "→"}
                              {" "}{variation >= 0 ? "+" : ""}{variation.toFixed(1)}%
                              {isBiggest && <span className="ml-1">🔥</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "rose" | "emerald" }) {
  const cls = accent === "rose"    ? "border-rose-200 bg-rose-50 text-rose-700"
            : accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-[var(--border)] bg-white text-[var(--text)]";
  const [border, bg, txt] = cls.split(" ");
  return (
    <div className={`rounded-[10px] border ${border} ${bg} p-3 shadow-sm`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${txt}`}>{value}</p>
    </div>
  );
}
