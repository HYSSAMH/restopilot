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
  return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formattedTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ── Types exposés ─────────────────────────────────────────────────────────

/**
 * Bloc d'identité partageable (émetteur ou fournisseur).
 * Tous les champs sont optionnels : la mise en page s'adapte.
 */
export interface PartyInfo {
  nom_commercial?:  string | null;
  nom_etablissement?: string | null;
  raison_sociale?:  string | null;
  siret?:           string | null;
  adresse_ligne1?:  string | null;
  adresse_ligne2?:  string | null;
  code_postal?:     string | null;
  ville?:           string | null;
  telephone?:       string | null;
  email_contact?:   string | null;
  email?:           string | null;
  logo_url?:        string | null;
  // Fournisseur-spécifiques
  iban?:               string | null;
  bic?:                string | null;
  horaires_livraison?: string | null;
  jours_livraison?:    string[] | null;
}

export interface GenerateFactureOptions {
  /** Profil du restaurateur (émetteur de la commande). */
  buyer?: PartyInfo | null;
  /** Profils des fournisseurs, indexés par leur id (= user_id). */
  sellers?: Record<string, PartyInfo>;
}

// ── Color helpers ─────────────────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  violet:      [124,  58, 237] as RGB,
  violetLight: [168, 100, 255] as RGB,
  violetPale:  [245, 243, 255] as RGB,
  dark:        [ 13,  13,  26] as RGB,
  slate:       [ 51,  51,  80] as RGB,
  gray:        [140, 140, 160] as RGB,
  lightGray:   [220, 220, 230] as RGB,
  white:       [255, 255, 255] as RGB,
  emerald:     [ 16, 185, 129] as RGB,
  amber:       [251, 191,  36] as RGB,
};

// ── Helpers texte/image ───────────────────────────────────────────────────

function partyName(p?: PartyInfo | null): string {
  if (!p) return "—";
  return p.nom_commercial || p.nom_etablissement || p.raison_sociale || "—";
}

function partyLines(p?: PartyInfo | null): string[] {
  if (!p) return [];
  const lines: string[] = [];
  if (p.raison_sociale && p.raison_sociale !== partyName(p)) lines.push(p.raison_sociale);
  if (p.adresse_ligne1) lines.push(p.adresse_ligne1);
  if (p.adresse_ligne2) lines.push(p.adresse_ligne2);
  const cpVille = [p.code_postal, p.ville].filter(Boolean).join(" ");
  if (cpVille) lines.push(cpVille);
  if (p.siret) lines.push(`SIRET ${p.siret}`);
  const contact = [p.telephone, p.email_contact || p.email].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  return lines;
}

async function loadImageAsDataUrl(url: string): Promise<{ data: string; format: "PNG" | "JPEG" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject();
      reader.readAsDataURL(blob);
    });
    const format: "PNG" | "JPEG" = data.startsWith("data:image/png") ? "PNG" : "JPEG";
    return { data, format };
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

export async function generateFacturePDF(
  cartMap: CartMap,
  options: GenerateFactureOptions = {},
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { buyer, sellers = {} } = options;

  // ── DEBUG : ce que le générateur reçoit ───────────────────
  console.group("[generateFacturePDF] données reçues");
  console.log("buyer :", buyer);
  console.log("buyer.raison_sociale :", buyer?.raison_sociale);
  console.log("buyer.siret :",          buyer?.siret);
  console.log("buyer.adresse_ligne1 :", buyer?.adresse_ligne1);
  console.log("buyer.code_postal :",    buyer?.code_postal);
  console.log("buyer.ville :",          buyer?.ville);
  console.log("buyer.telephone :",      buyer?.telephone);
  console.log("buyer.logo_url :",       buyer?.logo_url);
  console.log("sellers (par id) :", sellers);
  for (const [id, s] of Object.entries(sellers)) {
    console.log(`  seller[${id}] → raison=${s.raison_sociale ?? "∅"} siret=${s.siret ?? "∅"} iban=${s.iban ?? "∅"}`);
  }
  console.groupEnd();

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W  = 210;
  const M  = 14;
  const CW = W - M * 2;
  const ref  = orderRef();
  const date = formattedDate();
  const time = formattedTime();

  // Fetch logo if available (best-effort)
  const buyerLogo = buyer?.logo_url ? await loadImageAsDataUrl(buyer.logo_url) : null;

  const setFont = (size: number, style: "normal" | "bold" = "normal", color: RGB = C.dark) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  };
  const hRule = (y: number, color: RGB = C.lightGray, thick = 0.3) => {
    doc.setDrawColor(...color); doc.setLineWidth(thick); doc.line(M, y, W - M, y);
  };
  const fillRect = (x: number, y: number, w: number, h: number, color: RGB) => {
    doc.setFillColor(...color); doc.rect(x, y, w, h, "F");
  };
  const txt = (text: string, x: number, y: number, align: "left"|"right"|"center" = "left") => {
    doc.text(text, x, y, { align });
  };

  // ── PAGE HEADER (marque RestoPilot) ────────────────────────────────────
  fillRect(0, 0, W, 30, C.dark);
  fillRect(0, 0, 4, 30, C.violet);

  doc.setFillColor(...C.violet);
  doc.roundedRect(M, 8, 12, 12, 2, 2, "F");
  setFont(9, "bold", C.white);
  txt("🍽", M + 3, 16);

  setFont(14, "bold", C.white);
  txt("Resto", M + 16, 15);
  setFont(14, "bold", C.violetLight);
  txt("Pilot", M + 30, 15);
  setFont(7, "normal", C.gray);
  txt("La restauration intelligente", M + 16, 20);

  setFont(8, "normal", C.gray);
  txt("BON DE COMMANDE", W - M, 11, "right");
  setFont(12, "bold", C.white);
  txt(ref, W - M, 18, "right");
  setFont(7, "normal", C.gray);
  txt(date, W - M, 24, "right");

  // ── EMETTEUR (restaurateur) ────────────────────────────────────────────
  let y = 40;
  const boxH = 34;

  fillRect(M, y, CW, boxH, C.violetPale);
  doc.setDrawColor(...C.violetLight); doc.setLineWidth(0.3);
  doc.rect(M, y, CW, boxH);

  // Logo (si dispo)
  let textStartX = M + 4;
  if (buyerLogo) {
    try {
      doc.addImage(buyerLogo.data, buyerLogo.format, M + 4, y + 4, 20, 20, undefined, "FAST");
      textStartX = M + 28;
    } catch {
      textStartX = M + 4;
    }
  }

  setFont(6.5, "bold", C.gray);
  txt("ÉMETTEUR DE LA COMMANDE", textStartX, y + 5);
  setFont(10, "bold", C.dark);
  txt(partyName(buyer), textStartX, y + 10);

  const buyerLines = partyLines(buyer);
  setFont(7, "normal", C.slate);
  let yi = y + 15;
  buyerLines.slice(0, 4).forEach((line) => {
    txt(line, textStartX, yi);
    yi += 3.8;
  });

  // Date (coin droit de la box émetteur)
  setFont(6.5, "bold", C.gray);
  txt("DATE D'ÉMISSION", W - M - 4, y + 5, "right");
  setFont(8, "normal", C.dark);
  txt(`${date} · ${time}`, W - M - 4, y + 10, "right");

  y += boxH + 6;

  // ── GROUP ENTRIES BY FOURNISSEUR ───────────────────────────────────────
  const entries = Object.values(cartMap);
  type Group = {
    id: string;
    nom: string;
    minimum: number;
    items: { nom: string; unite: string; prix: number; qty: number }[];
    subtotal: number;
  };
  const groups: Record<string, Group> = {};
  let grandTotal = 0;
  let economies  = 0;

  entries.forEach(({ produit, fournisseur, qty }) => {
    if (!groups[fournisseur.id]) {
      groups[fournisseur.id] = {
        id: fournisseur.id, nom: fournisseur.nom, minimum: fournisseur.minimum,
        items: [], subtotal: 0,
      };
    }
    const lineTotal = fournisseur.prix * qty;
    groups[fournisseur.id].items.push({
      nom: produit.nom, unite: fournisseur.unite,
      prix: fournisseur.prix, qty,
    });
    groups[fournisseur.id].subtotal += lineTotal;
    grandTotal += lineTotal;

    const maxPrix = Math.max(...produit.fournisseurs.map((f) => f.prix));
    economies += (maxPrix - fournisseur.prix) * qty;
  });

  const COL = {
    produit: M + 2,
    qty:     M + 100,
    unite:   M + 116,
    prix:    M + 140,
    total:   W - M - 2,
  };

  // ── GROUPES FOURNISSEUR ────────────────────────────────────────────────
  Object.values(groups).forEach((group, gi) => {
    const seller = sellers[group.id] ?? null;

    // Estimation hauteur : bloc seller (~24) + header (~12) + items + footer
    const estimatedHeight = 24 + 14 + group.items.length * 8 + 18;
    if (y + estimatedHeight > 270) { doc.addPage(); y = 20; }

    // ── Bloc "Fournisseur" avec coordonnées facturation ────────────────
    fillRect(M, y, CW, 24, C.dark);
    setFont(6.5, "bold", [180, 180, 200]);
    txt("FOURNISSEUR", M + 4, y + 5);
    setFont(11, "bold", C.white);
    txt(partyName(seller) || group.nom, M + 4, y + 11);

    const sellerLines = partyLines(seller);
    setFont(7, "normal", [200, 200, 220]);
    let sy = y + 16;
    sellerLines.slice(0, 2).forEach((line) => {
      txt(line, M + 4, sy);
      sy += 3.5;
    });

    // IBAN à droite (si dispo)
    if (seller?.iban) {
      setFont(6.5, "bold", [180, 180, 200]);
      txt("IBAN", W - M - 4, y + 5, "right");
      setFont(8, "normal", C.white);
      txt(seller.iban, W - M - 4, y + 11, "right");
      if (seller.bic) {
        setFont(7, "normal", [200, 200, 220]);
        txt(`BIC ${seller.bic}`, W - M - 4, y + 16, "right");
      }
    }

    y += 26;

    // ── Column headers ──────────────────────────────────────────────
    setFont(6.5, "bold", C.gray);
    txt("DÉSIGNATION", COL.produit, y);
    txt("QTÉ",         COL.qty,     y, "right");
    txt("UNITÉ",       COL.unite,   y);
    txt("PRIX UNIT.",  COL.prix,    y, "right");
    txt("TOTAL HT",    COL.total,   y, "right");
    y += 3;
    hRule(y, C.lightGray, 0.2);
    y += 4;

    // ── Items ──────────────────────────────────────────────────────
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

    // ── Subtotal ───────────────────────────────────────────────────
    hRule(y, C.lightGray, 0.2);
    y += 4;
    fillRect(M + CW - 56, y - 4, 56, 8, [237, 233, 254]);
    setFont(7.5, "bold", C.violet);
    txt("Sous-total", COL.prix, y + 1, "right");
    txt(fmt(group.subtotal), COL.total, y + 1, "right");
    y += 10;

    // ── Infos livraison (si dispo) ─────────────────────────────────
    const livrInfo: string[] = [];
    if (seller?.jours_livraison && seller.jours_livraison.length > 0) {
      livrInfo.push(`Livraison : ${seller.jours_livraison.join(", ")}`);
    }
    if (seller?.horaires_livraison) {
      livrInfo.push(seller.horaires_livraison);
    }
    if (livrInfo.length > 0) {
      setFont(6.5, "normal", C.gray);
      txt(`Livraison : ${livrInfo.join(" · ")}`, M + 2, y);
      y += 4;
    }

    if (gi < Object.values(groups).length - 1) y += 6;
  });

  // ── TOTALS ─────────────────────────────────────────────────────────────
  if (y + 40 > 270) { doc.addPage(); y = 20; }

  y += 2;
  hRule(y, C.slate, 0.5);
  y += 6;

  if (economies > 0) {
    setFont(8.5, "normal", C.gray);
    txt("Économies réalisées (vs prix le plus élevé)", M + 2, y);
    setFont(8.5, "bold", C.emerald);
    txt(`−${fmt(economies)}`, W - M - 2, y, "right");
    y += 8;
  }

  fillRect(M, y - 1, CW, 12, C.violet);
  setFont(9, "normal", [220, 200, 255]);
  txt("TOTAL DE LA COMMANDE", M + 4, y + 7);
  setFont(12, "bold", C.white);
  txt(fmt(grandTotal), W - M - 4, y + 7, "right");
  y += 18;

  setFont(7, "normal", C.gray);
  txt("Minimums de commande :", M + 2, y);
  y += 5;
  Object.values(groups).forEach((g) => {
    const ok = g.subtotal >= g.minimum;
    setFont(6.5, "normal", ok ? C.emerald : C.amber);
    txt(
      `${ok ? "✓" : "⚠"} ${g.nom} — ${fmt(g.subtotal)} / ${fmt(g.minimum)} min.`,
      M + 6, y,
    );
    y += 4.5;
  });

  // ── FOOTER ─────────────────────────────────────────────────────────────
  const footerY = 287;
  hRule(footerY - 6, C.lightGray, 0.3);
  setFont(6.5, "normal", C.gray);
  txt("RestoPilot — Plateforme SaaS pour la restauration", M, footerY, "left");
  const footerRight = [
    `Réf. ${ref}`,
    buyer?.siret ? `SIRET émetteur : ${buyer.siret}` : null,
  ].filter(Boolean).join(" · ");
  txt(footerRight, W - M, footerY, "right");

  doc.save(`RestoPilot-commande-${ref}.pdf`);
}
