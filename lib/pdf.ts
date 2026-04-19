import type { CartMap } from "@/components/commande/data";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

function zeroPad(n: number) {
  return String(n).padStart(2, "0");
}

function orderRef() {
  const now = new Date();
  return `RP-${now.getFullYear()}${zeroPad(now.getMonth() + 1)}${zeroPad(now.getDate())}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function formattedDate() {
  return new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formattedTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ── Color helpers ──────────────────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  violet:     [124,  58, 237] as RGB,
  violetLight:[168, 100, 255] as RGB,
  dark:       [ 13,  13,  26] as RGB,
  slate:      [ 51,  51,  80] as RGB,
  gray:       [140, 140, 160] as RGB,
  lightGray:  [220, 220, 230] as RGB,
  white:      [255, 255, 255] as RGB,
  emerald:    [ 16, 185, 129] as RGB,
  amber:      [251, 191,  36] as RGB,
};

export async function generateFacturePDF(
  cartMap: CartMap,
  restaurantName = "Le Bistrot Parisien"
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210;
  const M = 14; // left/right margin
  const CW = W - M * 2; // content width: 182mm
  const ref = orderRef();
  const date = formattedDate();
  const time = formattedTime();

  // ── Helper drawing functions ──────────────────────────────────────────────
  const setFont = (size: number, style: "normal" | "bold" = "normal", color: RGB = C.dark) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  };

  const hRule = (y: number, color: RGB = C.lightGray, thick = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(thick);
    doc.line(M, y, W - M, y);
  };

  const fillRect = (x: number, y: number, w: number, h: number, color: RGB) => {
    doc.setFillColor(...color);
    doc.rect(x, y, w, h, "F");
  };

  const txt = (
    text: string,
    x: number,
    y: number,
    align: "left" | "right" | "center" = "left"
  ) => {
    doc.text(text, x, y, { align });
  };

  // ── PAGE HEADER ───────────────────────────────────────────────────────────
  // Dark header band
  fillRect(0, 0, W, 36, C.dark);

  // Violet accent stripe
  fillRect(0, 0, 4, 36, C.violet);

  // Logo area
  doc.setFillColor(...C.violet);
  doc.roundedRect(M, 10, 14, 14, 2, 2, "F");
  setFont(9, "bold", C.white);
  txt("🍽", M + 3.5, 19.5);

  setFont(16, "bold", C.white);
  txt("Resto", M + 18, 19);
  setFont(16, "bold", C.violetLight);
  txt("Pilot", M + 34, 19);

  setFont(7, "normal", C.gray);
  txt("La restauration intelligente", M + 18, 24);

  // Right side: ref + date
  setFont(8, "normal", C.gray);
  txt("BON DE COMMANDE", W - M, 13, "right");
  setFont(12, "bold", C.white);
  txt(ref, W - M, 21, "right");
  setFont(7, "normal", C.gray);
  txt(date, W - M, 27, "right");

  // ── RESTAURANT INFO ───────────────────────────────────────────────────────
  let y = 46;

  fillRect(M, y - 5, CW, 14, [245, 243, 255]);
  doc.setDrawColor(...C.violetLight);
  doc.setLineWidth(0.4);
  doc.rect(M, y - 5, CW, 14);

  setFont(7, "normal", C.gray);
  txt("COMMANDÉ PAR", M + 4, y + 0.5);
  setFont(9, "bold", C.dark);
  txt(restaurantName, M + 4, y + 5.5);
  setFont(7, "normal", C.gray);
  txt(`Généré le ${date} à ${time}`, W - M - 4, y + 5.5, "right");

  y += 16;

  // ── GROUP ENTRIES BY FOURNISSEUR ──────────────────────────────────────────
  const entries = Object.values(cartMap);

  const groups: Record<string, {
    nom: string;
    minimum: number;
    initiale: string;
    items: { nom: string; icone: string; unite: string; prix: number; qty: number }[];
    subtotal: number;
  }> = {};

  let grandTotal = 0;
  let economies = 0;

  entries.forEach(({ produit, fournisseur, qty }) => {
    if (!groups[fournisseur.id]) {
      groups[fournisseur.id] = {
        nom: fournisseur.nom,
        minimum: fournisseur.minimum,
        initiale: fournisseur.initiale,
        items: [],
        subtotal: 0,
      };
    }
    const lineTotal = fournisseur.prix * qty;
    groups[fournisseur.id].items.push({
      nom: produit.nom,
      icone: produit.icone,
      unite: fournisseur.unite,
      prix: fournisseur.prix,
      qty,
    });
    groups[fournisseur.id].subtotal += lineTotal;
    grandTotal += lineTotal;

    const maxPrix = Math.max(...produit.fournisseurs.map((f) => f.prix));
    economies += (maxPrix - fournisseur.prix) * qty;
  });

  // Column X positions
  const COL = {
    produit: M + 2,
    qty:     M + 100,
    unite:   M + 116,
    prix:    M + 140,
    total:   W - M - 2,
  };

  // ── FOURNISSEUR GROUPS ────────────────────────────────────────────────────
  Object.values(groups).forEach((group, gi) => {
    // Page break check
    const estimatedHeight = 28 + group.items.length * 8;
    if (y + estimatedHeight > 270) {
      doc.addPage();
      y = 20;
    }

    // Fournisseur header band
    fillRect(M, y, CW, 10, C.dark);
    setFont(8, "bold", C.white);
    txt(group.nom.toUpperCase(), M + 4, y + 6.5);
    setFont(7, "normal", C.gray);
    txt(`Min. ${fmt(group.minimum)}`, W - M - 4, y + 6.5, "right");
    y += 12;

    // Column headers
    setFont(6.5, "bold", C.gray);
    txt("DÉSIGNATION", COL.produit, y);
    txt("QTÉ", COL.qty, y, "right");
    txt("UNITÉ", COL.unite, y);
    txt("PRIX UNIT.", COL.prix, y, "right");
    txt("TOTAL HT", COL.total, y, "right");
    y += 3;
    hRule(y, C.lightGray, 0.2);
    y += 4;

    // Items
    group.items.forEach((item, ii) => {
      if (ii % 2 === 0) fillRect(M, y - 3.5, CW, 7.5, [251, 250, 255]);

      setFont(8, "normal", C.dark);
      txt(item.nom, COL.produit, y);
      txt(String(item.qty), COL.qty, y, "right");
      setFont(8, "normal", C.gray);
      txt(item.unite, COL.unite, y);
      setFont(8, "normal", C.dark);
      txt(fmt(item.prix), COL.prix, y, "right");
      setFont(8, "bold", C.dark);
      txt(fmt(item.prix * item.qty), COL.total, y, "right");
      y += 7.5;
    });

    // Subtotal row
    hRule(y, C.lightGray, 0.2);
    y += 4;
    fillRect(M + CW - 56, y - 4, 56, 8, [237, 233, 254]);
    setFont(7.5, "bold", C.violet);
    txt("Sous-total", COL.prix, y + 1, "right");
    txt(fmt(group.subtotal), COL.total, y + 1, "right");
    y += 10;

    if (gi < Object.values(groups).length - 1) y += 4;
  });

  // ── TOTALS SECTION ────────────────────────────────────────────────────────
  if (y + 40 > 270) { doc.addPage(); y = 20; }

  y += 2;
  hRule(y, C.slate, 0.5);
  y += 6;

  // Economies row
  if (economies > 0) {
    setFont(8.5, "normal", C.gray);
    txt("Économies réalisées (vs prix le plus élevé)", M + 2, y);
    setFont(8.5, "bold", C.emerald);
    txt(`−${fmt(economies)}`, W - M - 2, y, "right");
    y += 8;
  }

  // Grand total band
  fillRect(M, y - 1, CW, 12, C.violet);
  setFont(9, "normal", [220, 200, 255]);
  txt("TOTAL DE LA COMMANDE", M + 4, y + 7);
  setFont(12, "bold", C.white);
  txt(fmt(grandTotal), W - M - 4, y + 7, "right");
  y += 18;

  // Minimums recap
  setFont(7, "normal", C.gray);
  txt("Minimums de commande :", M + 2, y);
  y += 5;
  Object.values(groups).forEach((g) => {
    const ok = g.subtotal >= g.minimum;
    setFont(6.5, "normal", ok ? C.emerald : C.amber);
    txt(
      `${ok ? "✓" : "⚠"} ${g.nom} — ${fmt(g.subtotal)} / ${fmt(g.minimum)} min.`,
      M + 6,
      y
    );
    y += 4.5;
  });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = 287;
  hRule(footerY - 6, C.lightGray, 0.3);
  setFont(6.5, "normal", C.gray);
  txt("RestoPilot — Plateforme SaaS pour la restauration", M, footerY, "left");
  txt(`Réf. ${ref} · ${date}`, W - M, footerY, "right");

  // ── SAVE ──────────────────────────────────────────────────────────────────
  doc.save(`RestoPilot-commande-${ref}.pdf`);
}
