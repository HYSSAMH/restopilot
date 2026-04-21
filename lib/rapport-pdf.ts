/**
 * Générateurs PDF pour les 4 rapports de gestion restaurateur.
 * Utilise jsPDF (déjà installé).
 */
import type { Commande } from "@/lib/gestion-data";
import { montantNet, fournIdOf, CAT_LABELS } from "@/lib/gestion-data";

interface Profile {
  nom_commercial?:  string | null;
  nom_etablissement?: string | null;
  raison_sociale?:  string | null;
  siret?:           string | null;
  adresse_ligne1?:  string | null;
  code_postal?:     string | null;
  ville?:           string | null;
  telephone?:       string | null;
  logo_url?:        string | null;
}

interface CaJournalier {
  date:          string;
  ca_total:      number;
  especes_total: number;
  cb_montant:    number;
  tr_total:      number;
  autres_total:  number;
}

const IND = [26, 26, 46] as const;
const GRAY = [140, 140, 160] as const;
const LIGHT = [238, 242, 255] as const;
const DANGER = [225, 29, 72] as const;
const SUCCESS = [16, 185, 129] as const;

function fmt(n: number): string {
  return Number(n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

async function loadLogo(url: string | null | undefined): Promise<{ data: string; format: "PNG"|"JPEG" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject();
      r.readAsDataURL(blob);
    });
    return { data, format: data.startsWith("data:image/png") ? "PNG" : "JPEG" };
  } catch { return null; }
}

async function drawHeader(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any, titre: string, sousTitre: string, profile: Profile,
): Promise<number> {
  const W = 210, M = 14;

  doc.setFillColor(...IND);
  doc.rect(0, 0, W, 32, "F");

  // Logo si dispo
  const logo = await loadLogo(profile.logo_url);
  let textX = M;
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, M, 6, 20, 20, undefined, "FAST");
      textX = M + 25;
    } catch { /* skip */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(profile.nom_commercial || profile.nom_etablissement || "RestoPilot", textX, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const contactLine = [profile.siret ? `SIRET ${profile.siret}` : "", profile.telephone ?? ""].filter(Boolean).join(" · ");
  if (contactLine) doc.text(contactLine, textX, 19);
  const addrLine = [profile.adresse_ligne1, [profile.code_postal, profile.ville].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  if (addrLine) doc.text(addrLine, textX, 23);

  doc.setFontSize(9);
  doc.text(titre,      W - M, 14, { align: "right" });
  doc.setFontSize(7);
  doc.text(sousTitre,  W - M, 19, { align: "right" });
  doc.text(new Date().toLocaleDateString("fr-FR"), W - M, 23, { align: "right" });

  return 38;   // y de départ du contenu
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawFooter(doc: any) {
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY);
  doc.text("Rapport généré par RestoPilot", 14, 290);
  doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, 196, 290, { align: "right" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawKpiGrid(doc: any, y: number, kpis: { label: string; value: string }[]): number {
  const W = 210, M = 14, gap = 4, cols = Math.min(4, kpis.length);
  const w = (W - 2 * M - gap * (cols - 1)) / cols;
  kpis.forEach((k, i) => {
    const x = M + (i % cols) * (w + gap);
    const ry = y + Math.floor(i / cols) * 22;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, ry, w, 18, 2, 2, "F");
    doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    doc.text(k.label.toUpperCase(), x + 3, ry + 5);
    doc.setTextColor(...IND); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(k.value, x + 3, ry + 13);
  });
  return y + Math.ceil(kpis.length / cols) * 22 + 4;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawTable(doc: any, y: number, headers: string[], rows: string[][], colAligns?: ("left"|"right")[]): number {
  const W = 210, M = 14;
  const colW = (W - 2 * M) / headers.length;

  doc.setFillColor(...IND);
  doc.rect(M, y, W - 2 * M, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => {
    const align = colAligns?.[i] ?? "left";
    const x = align === "right" ? M + colW * (i + 1) - 2 : M + colW * i + 2;
    doc.text(h, x, y + 4.5, { align });
  });
  y += 9;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...IND);
  rows.forEach((r, ri) => {
    if (y > 275) { doc.addPage(); y = 20; }
    if (ri % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(M, y - 4, W - 2 * M, 6, "F");
    }
    r.forEach((cell, i) => {
      const align = colAligns?.[i] ?? "left";
      const x = align === "right" ? M + colW * (i + 1) - 2 : M + colW * i + 2;
      doc.text(String(cell).slice(0, 50), x, y, { align });
    });
    y += 6;
  });
  return y + 3;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawTitle(doc: any, y: number, text: string): number {
  doc.setTextColor(...IND);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(text, 14, y);
  return y + 5;
}

// ───────────────────────────────────────────────────────────────────
// RAPPORT MENSUEL
// ───────────────────────────────────────────────────────────────────

export async function generateRapportMensuel(
  mois: string,                       // "YYYY-MM"
  commandes: Commande[],
  caMois: CaJournalier[],
  categories: Record<string, string>,
  fournNames: Record<string, string>,
  profile: Profile,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const moisLabel = new Date(mois + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  let y = await drawHeader(doc, "Rapport mensuel", moisLabel, profile);

  // ── CA par mode ──────────────────────────────────────────────
  const caTotal     = caMois.reduce((s, c) => s + Number(c.ca_total ?? 0), 0);
  const especes     = caMois.reduce((s, c) => s + Number(c.especes_total ?? 0), 0);
  const cb          = caMois.reduce((s, c) => s + Number(c.cb_montant ?? 0),    0);
  const tr          = caMois.reduce((s, c) => s + Number(c.tr_total ?? 0),      0);
  const autres      = caMois.reduce((s, c) => s + Number(c.autres_total ?? 0),  0);

  const cmdsMois = commandes.filter(c =>
    c.created_at.startsWith(mois) && c.statut !== "annulee",
  );
  const depenses = cmdsMois.reduce((s, c) => s + montantNet(c), 0);
  const coutMat  = caTotal > 0 ? (depenses / caTotal) * 100 : 0;
  const marge    = caTotal - depenses;

  // Mois précédent
  const d = new Date(mois + "-01"); d.setMonth(d.getMonth() - 1);
  const moisPrecIso = d.toISOString().slice(0, 7);
  const depensesPrec = commandes
    .filter(c => c.created_at.startsWith(moisPrecIso) && c.statut !== "annulee")
    .reduce((s, c) => s + montantNet(c), 0);
  const evolDepense = depensesPrec > 0 ? ((depenses - depensesPrec) / depensesPrec) * 100 : 0;

  y = drawKpiGrid(doc, y, [
    { label: "CA total",         value: fmt(caTotal) },
    { label: "Dépenses",         value: fmt(depenses) },
    { label: "Coût matière",     value: `${coutMat.toFixed(1)} %` },
    { label: "Marge brute",      value: fmt(marge) },
  ]);

  y = drawTitle(doc, y + 4, "Détail CA par mode de paiement");
  y = drawTable(doc, y, ["Mode", "Montant"], [
    ["Espèces",          fmt(especes)],
    ["Carte bancaire",   fmt(cb)],
    ["Tickets restaurant", fmt(tr)],
    ["Autres (virement, chèque)", fmt(autres)],
    ["— TOTAL CA —",     fmt(caTotal)],
  ], ["left", "right"]);

  // ── Dépenses par catégorie ────────────────────────────────────
  const byCat = new Map<string, number>();
  cmdsMois.forEach(c => c.lignes_commande.forEach(l => {
    const cat = categories[l.nom_snapshot] ?? "epicerie";
    const v = Number(l.prix_snapshot) * Number(l.quantite);
    byCat.set(cat, (byCat.get(cat) ?? 0) + v);
  }));
  const catRows = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [CAT_LABELS[k] ?? k, fmt(v), `${(v / depenses * 100).toFixed(1)} %`]);

  y = drawTitle(doc, y + 4, "Dépenses par catégorie");
  y = drawTable(doc, y,
    ["Catégorie", "Montant", "% des dépenses"],
    catRows.length > 0 ? catRows : [["—", "—", "—"]],
    ["left", "right", "right"],
  );

  // ── Comparaison mois précédent ───────────────────────────────
  y = drawTitle(doc, y + 4, "Comparaison avec le mois précédent");
  doc.setTextColor(evolDepense > 0 ? DANGER[0] : SUCCESS[0], evolDepense > 0 ? DANGER[1] : SUCCESS[1], evolDepense > 0 ? DANGER[2] : SUCCESS[2]);
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text(
    `Dépenses : ${fmt(depensesPrec)} → ${fmt(depenses)} (${evolDepense >= 0 ? "+" : ""}${evolDepense.toFixed(1)}%)`,
    14, y,
  );

  // ── Fournisseurs ───────────────────────────────────────────────
  const byFourn = new Map<string, number>();
  cmdsMois.forEach(c => {
    const fId = fournIdOf(c);
    if (!fId) return;
    byFourn.set(fId, (byFourn.get(fId) ?? 0) + montantNet(c));
  });
  const fournRows = Array.from(byFourn.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, v]) => [fournNames[id] ?? id.slice(0, 6), fmt(v)]);

  y = drawTitle(doc, y + 10, "Top fournisseurs du mois");
  y = drawTable(doc, y, ["Fournisseur", "Dépenses"], fournRows.length > 0 ? fournRows : [["—", "—"]], ["left", "right"]);

  drawFooter(doc);
  doc.save(`RestoPilot-rapport-mensuel-${mois}.pdf`);
}

// ───────────────────────────────────────────────────────────────────
// RAPPORT ANNUEL
// ───────────────────────────────────────────────────────────────────

export async function generateRapportAnnuel(
  annee: number,
  commandes: Commande[],
  ca12m: CaJournalier[],
  profile: Profile,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = await drawHeader(doc, "Rapport annuel", String(annee), profile);

  // Synthèse par mois
  const moisData: { mois: string; ca: number; depenses: number; marge: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const key = `${annee}-${String(m + 1).padStart(2, "0")}`;
    const ca = ca12m.filter(c => c.date.startsWith(key)).reduce((s, c) => s + Number(c.ca_total ?? 0), 0);
    const dep = commandes.filter(c => c.created_at.startsWith(key) && c.statut !== "annulee")
                         .reduce((s, c) => s + montantNet(c), 0);
    moisData.push({ mois: key, ca, depenses: dep, marge: ca - dep });
  }

  const caTotal   = moisData.reduce((s, m) => s + m.ca, 0);
  const depTotal  = moisData.reduce((s, m) => s + m.depenses, 0);
  const margeTot  = caTotal - depTotal;
  const coutTot   = caTotal > 0 ? (depTotal / caTotal) * 100 : 0;

  y = drawKpiGrid(doc, y, [
    { label: "CA total",      value: fmt(caTotal) },
    { label: "Dépenses",      value: fmt(depTotal) },
    { label: "Marge brute",   value: fmt(margeTot) },
    { label: "Coût matière",  value: `${coutTot.toFixed(1)} %` },
  ]);

  const best = [...moisData].filter(m => m.marge > 0).sort((a, b) => b.marge - a.marge)[0];
  const worst = [...moisData].filter(m => m.marge < 0).sort((a, b) => a.marge - b.marge)[0];

  y = drawTitle(doc, y + 4, "Tendances");
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...IND);
  if (best)  { doc.text(`Meilleur mois (marge) : ${best.mois}  → ${fmt(best.marge)}`, 14, y); y += 5; }
  if (worst) { doc.text(`Pire mois (marge) : ${worst.mois}  → ${fmt(worst.marge)}`,    14, y); y += 5; }

  y = drawTitle(doc, y + 4, "Détail par mois");
  y = drawTable(doc, y,
    ["Mois", "CA", "Dépenses", "Marge", "Coût mat."],
    moisData.map(m => [
      m.mois,
      fmt(m.ca),
      fmt(m.depenses),
      fmt(m.marge),
      m.ca > 0 ? `${(m.depenses / m.ca * 100).toFixed(1)} %` : "—",
    ]),
    ["left", "right", "right", "right", "right"],
  );

  drawFooter(doc);
  doc.save(`RestoPilot-rapport-annuel-${annee}.pdf`);
}

// ───────────────────────────────────────────────────────────────────
// RAPPORT FOURNISSEURS
// ───────────────────────────────────────────────────────────────────

export async function generateRapportFournisseurs(
  from: Date, to: Date,
  commandes: Commande[],
  fournNames: Record<string, string>,
  profile: Profile,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const sousTitre = `Du ${from.toLocaleDateString("fr-FR")} au ${to.toLocaleDateString("fr-FR")}`;
  let y = await drawHeader(doc, "Rapport fournisseurs", sousTitre, profile);

  const cmdsPeriode = commandes.filter(c => {
    const d = new Date(c.created_at);
    return c.statut !== "annulee" && d >= from && d <= to;
  });

  const byFourn = new Map<string, { total: number; nb: number; derniere: string }>();
  cmdsPeriode.forEach(c => {
    const fId = fournIdOf(c);
    if (!fId) return;
    if (!byFourn.has(fId)) byFourn.set(fId, { total: 0, nb: 0, derniere: c.created_at });
    const e = byFourn.get(fId)!;
    e.total += montantNet(c);
    e.nb += 1;
    if (c.created_at > e.derniere) e.derniere = c.created_at;
  });

  const rows = Array.from(byFourn.entries())
    .map(([id, e]) => [
      fournNames[id] ?? id.slice(0, 6),
      String(e.nb),
      fmt(e.total),
      new Date(e.derniere).toLocaleDateString("fr-FR"),
    ])
    .sort((a, b) => parseFloat(String(b[2]).replace(/[^\d,]/g, "").replace(",", ".")) - parseFloat(String(a[2]).replace(/[^\d,]/g, "").replace(",", ".")));

  const total = Array.from(byFourn.values()).reduce((s, e) => s + e.total, 0);

  y = drawKpiGrid(doc, y, [
    { label: "Fournisseurs", value: String(byFourn.size) },
    { label: "Commandes",    value: String(cmdsPeriode.length) },
    { label: "Dépenses",     value: fmt(total) },
  ]);

  y = drawTitle(doc, y + 4, "Détail par fournisseur");
  y = drawTable(doc, y,
    ["Fournisseur", "Cmdes", "Dépenses", "Dernier achat"],
    rows.length > 0 ? rows : [["—", "—", "—", "—"]],
    ["left", "right", "right", "right"],
  );

  drawFooter(doc);
  doc.save(`RestoPilot-rapport-fournisseurs-${new Date().toISOString().slice(0,10)}.pdf`);
}

// ───────────────────────────────────────────────────────────────────
// RAPPORT PRODUITS
// ───────────────────────────────────────────────────────────────────

export async function generateRapportProduits(
  from: Date, to: Date,
  commandes: Commande[],
  profile: Profile,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const sousTitre = `Du ${from.toLocaleDateString("fr-FR")} au ${to.toLocaleDateString("fr-FR")}`;
  let y = await drawHeader(doc, "Rapport produits", sousTitre, profile);

  const byProduit = new Map<string, {
    nom: string; qte: number; valeur: number; prixMin: number; prixMax: number; achats: number;
  }>();
  commandes.forEach(c => {
    const d = new Date(c.created_at);
    if (c.statut === "annulee" || d < from || d > to) return;
    c.lignes_commande.forEach(l => {
      const k = l.nom_snapshot.toLowerCase().trim();
      const p = Number(l.prix_snapshot);
      if (!byProduit.has(k)) byProduit.set(k, { nom: l.nom_snapshot, qte: 0, valeur: 0, prixMin: p, prixMax: p, achats: 0 });
      const e = byProduit.get(k)!;
      e.qte    += Number(l.quantite);
      e.valeur += Number(l.quantite) * p;
      e.prixMin = Math.min(e.prixMin, p);
      e.prixMax = Math.max(e.prixMax, p);
      e.achats += 1;
    });
  });
  const tri = Array.from(byProduit.values()).sort((a, b) => b.valeur - a.valeur);

  y = drawKpiGrid(doc, y, [
    { label: "Produits uniques", value: String(byProduit.size) },
    { label: "Valeur totale",    value: fmt(tri.reduce((s, e) => s + e.valeur, 0)) },
  ]);

  y = drawTitle(doc, y + 4, "Top 30 produits (par valeur)");
  y = drawTable(doc, y,
    ["Produit", "Achats", "Qté", "Min", "Max", "Valeur"],
    tri.slice(0, 30).map(e => [
      e.nom,
      String(e.achats),
      e.qte.toFixed(1),
      fmt(e.prixMin),
      fmt(e.prixMax),
      fmt(e.valeur),
    ]),
    ["left", "right", "right", "right", "right", "right"],
  );

  drawFooter(doc);
  doc.save(`RestoPilot-rapport-produits-${new Date().toISOString().slice(0,10)}.pdf`);
}
