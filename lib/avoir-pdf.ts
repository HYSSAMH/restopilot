/**
 * Générateur d'avoir PDF pour les réceptions avec anomalies.
 * Utilise jsPDF (déjà installé pour les factures).
 */

export interface AvoirLine {
  nom:             string;
  unite:           string;
  prix_unitaire:   number;
  qte_commandee:   number;
  qte_recue:       number;
  motif:           string | null;   // ex : "abîmé", "manquant", "mauvaise qualité"
}

export interface AvoirPartyInfo {
  nom:       string;
  raison?:   string | null;
  siret?:    string | null;
  adresse?:  string | null;
  cp_ville?: string | null;
}

export interface AvoirData {
  reference:       string;                  // ex : "AV-20260420-1234"
  commandeRef?:    string;                  // facture d'origine
  date:            string;                  // DD/MM/YYYY
  lignes:          AvoirLine[];
  buyer:           AvoirPartyInfo;          // restaurateur
  seller:          AvoirPartyInfo | null;   // fournisseur (peut être vide)
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export async function generateAvoirPDF(data: AvoirData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;

  const ROSE:   [number, number, number] = [225, 29,  72];
  const DARK:   [number, number, number] = [26,  26,  46];
  const GRAY:   [number, number, number] = [140, 140, 160];
  const LIGHT:  [number, number, number] = [251, 230, 235];
  const WHITE:  [number, number, number] = [255, 255, 255];

  // Header bandeau rose
  doc.setFillColor(...ROSE);
  doc.rect(0, 0, W, 30, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("AVOIR", M, 15);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Note de crédit suite à réception", M, 21);

  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(data.reference, W - M, 13, { align: "right" });
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text(`Émis le ${data.date}`, W - M, 19, { align: "right" });
  if (data.commandeRef) {
    doc.text(`Facture d'origine : ${data.commandeRef}`, W - M, 24, { align: "right" });
  }

  // ÉMETTEUR (buyer) / DESTINATAIRE (seller)
  let y = 42;

  doc.setTextColor(...DARK);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("RESTAURATEUR (demandeur de l'avoir)", M, y);
  doc.text("DISTRIBUTEUR (débiteur)", W / 2 + 4, y);
  y += 4;

  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(data.buyer.nom, M, y);
  if (data.seller) doc.text(data.seller.nom, W / 2 + 4, y);
  y += 4;

  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  const buyerLines: string[] = [
    data.buyer.raison ?? "",
    data.buyer.adresse ?? "",
    data.buyer.cp_ville ?? "",
    data.buyer.siret ? `SIRET ${data.buyer.siret}` : "",
  ].filter(Boolean);
  const sellerLines: string[] = data.seller ? [
    data.seller.raison ?? "",
    data.seller.adresse ?? "",
    data.seller.cp_ville ?? "",
    data.seller.siret ? `SIRET ${data.seller.siret}` : "",
  ].filter(Boolean) : [];

  const maxLines = Math.max(buyerLines.length, sellerLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (buyerLines[i]) doc.text(buyerLines[i], M, y);
    if (sellerLines[i]) doc.text(sellerLines[i], W / 2 + 4, y);
    y += 3.5;
  }

  y += 6;

  // Table
  doc.setFillColor(...DARK);
  doc.rect(M, y, W - 2 * M, 8, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("PRODUIT",    M + 2,       y + 5.5);
  doc.text("CMD",        M + 92,      y + 5.5, { align: "right" });
  doc.text("REÇU",       M + 110,     y + 5.5, { align: "right" });
  doc.text("ÉCART",      M + 128,     y + 5.5, { align: "right" });
  doc.text("MOTIF",      M + 136,     y + 5.5);
  doc.text("AVOIR",      W - M - 2,   y + 5.5, { align: "right" });
  y += 10;

  doc.setTextColor(...DARK);
  let totalAvoir = 0;

  data.lignes.forEach((l, i) => {
    if (y > 260) { doc.addPage(); y = 20; }
    const ecart   = l.qte_commandee - l.qte_recue;
    const montant = ecart * l.prix_unitaire;
    totalAvoir += Math.max(0, montant);

    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT);
      doc.rect(M, y - 4, W - 2 * M, 7, "F");
    }

    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(l.nom.slice(0, 45), M + 2, y);
    doc.text(`${l.qte_commandee} ${l.unite}`, M + 92, y, { align: "right" });
    doc.text(`${l.qte_recue} ${l.unite}`,     M + 110, y, { align: "right" });
    doc.text(ecart > 0 ? `-${ecart}` : "0",   M + 128, y, { align: "right" });
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text((l.motif ?? "").slice(0, 22), M + 136, y);
    doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(Math.max(0, montant)), W - M - 2, y, { align: "right" });
    y += 7;
  });

  y += 4;
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 6;

  // Total
  doc.setFillColor(...ROSE);
  doc.rect(M, y - 3, W - 2 * M, 12, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("TOTAL AVOIR À DÉDUIRE", M + 3, y + 5);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(fmt(totalAvoir), W - M - 3, y + 5, { align: "right" });

  // Footer
  doc.setTextColor(...GRAY);
  doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
  doc.text(
    "RestoPilot · Document d'avoir généré automatiquement suite à une réception avec anomalies.",
    M, 290,
  );
  doc.text(`Réf. ${data.reference} · ${data.date}`, W - M, 290, { align: "right" });

  doc.save(`RestoPilot-avoir-${data.reference}.pdf`);
}
