import { createClient } from "@/lib/supabase/client";

export interface Ligne {
  id:             string;
  nom_snapshot:   string;
  prix_snapshot:  number;
  unite:          string;
  quantite:       number;
}

export interface Commande {
  id:                     string;
  fournisseur_id:         string | null;
  fournisseur_externe_id: string | null;
  statut:                 string;
  montant_total:          number;
  avoir_montant:          number | null;
  avoir_statut:           string | null;
  source:                 string | null;
  created_at:             string;
  lignes_commande:        Ligne[];
}

export interface LoadedData {
  commandes:    Commande[];
  fournNames:   Record<string, string>;
  categories:   Record<string, string>;   // nom_produit → categorie (depuis le catalogue ou déduit)
}

const CAT_KEYWORDS: { cat: string; kws: string[] }[] = [
  { cat: "boucherie",       kws: ["bœuf","boeuf","veau","agneau","porc","poulet","volaille","charcuterie","jambon","saucisse","côte","cote","entrecote","entrecôte","filet","escalope"] },
  { cat: "poissonnerie",    kws: ["poisson","saumon","cabillaud","thon","crevette","langoustine","huître","huitre","moule","bar","dorade","sole","lotte","crustacé"] },
  { cat: "fruits",          kws: ["pomme","poire","banane","orange","citron","fraise","framboise","raisin","cerise","pêche","pech","abricot","ananas","mangue","kiwi","melon","pastèque"] },
  { cat: "legumes",         kws: ["tomate","courgette","aubergine","poivron","oignon","ail","carotte","poireau","haricot","champignon","épinard","brocoli","chou","concombre","radis"] },
  { cat: "pommes_de_terre", kws: ["pomme de terre","patate","grenaille","charlotte"] },
  { cat: "salades",         kws: ["salade","laitue","roquette","mesclun","scarole","mache","mâche","frisée","endive"] },
  { cat: "herbes",          kws: ["persil","basilic","menthe","ciboulette","coriandre","thym","romarin","estragon","aneth","sauge","origan"] },
  { cat: "cremerie",        kws: ["lait","beurre","crème","creme","fromage","yaourt","œuf","oeuf","camembert","comté","comte","mozzarella","parmesan"] },
];
function guessCategorie(nom: string): string {
  const n = nom.toLowerCase();
  for (const { cat, kws } of CAT_KEYWORDS) {
    if (kws.some(k => n.includes(k))) return cat;
  }
  return "epicerie";
}

export const CAT_LABELS: Record<string, string> = {
  boucherie:       "Boucherie",
  poissonnerie:    "Poissonnerie",
  fruits:          "Fruits",
  legumes:         "Légumes",
  pommes_de_terre: "Pommes de terre",
  salades:         "Salades",
  herbes:          "Herbes",
  cremerie:        "Crèmerie",
  epicerie:        "Épicerie",
};
export const CAT_COLORS: Record<string, string> = {
  boucherie:       "#DC2626",
  poissonnerie:    "#0EA5E9",
  fruits:          "#F97316",
  legumes:         "#16A34A",
  pommes_de_terre: "#CA8A04",
  salades:         "#84CC16",
  herbes:          "#22C55E",
  cremerie:        "#FBBF24",
  epicerie:        "#6366F1",
};

export async function loadRestaurateurData(): Promise<LoadedData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { commandes: [], fournNames: {}, categories: {} };

  // 1. Commandes + lignes
  const { data: cmds } = await supabase
    .from("commandes")
    .select(`
      id, fournisseur_id, fournisseur_externe_id, statut, montant_total,
      avoir_montant, avoir_statut, source, created_at,
      lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite )
    `)
    .eq("restaurateur_id", user.id)
    .order("created_at", { ascending: true })
    .limit(2000);

  const commandes = (cmds ?? []) as unknown as Commande[];

  // 2. Noms fournisseurs (profils + externes)
  const internalIds = Array.from(new Set(commandes.map(c => c.fournisseur_id).filter((x): x is string => !!x)));
  const externalIds = Array.from(new Set(commandes.map(c => c.fournisseur_externe_id).filter((x): x is string => !!x)));
  const fournNames: Record<string, string> = {};
  if (internalIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, nom_commercial, nom_etablissement").in("id", internalIds);
    (data ?? []).forEach(p => { fournNames[p.id] = p.nom_commercial || p.nom_etablissement || "—"; });
  }
  if (externalIds.length > 0) {
    const { data } = await supabase.from("fournisseurs_externes").select("id, nom").in("id", externalIds);
    (data ?? []).forEach(e => { fournNames[e.id] = `${e.nom} (externe)`; });
  }

  // 3. Catégorisation produits : check le catalogue pour les produits connus
  const produitsNoms = Array.from(new Set(commandes.flatMap(c => c.lignes_commande.map(l => l.nom_snapshot))));
  const categories: Record<string, string> = {};
  if (produitsNoms.length > 0) {
    const { data: produits } = await supabase
      .from("produits").select("nom, categorie").limit(2000);
    const catMap = new Map<string, string>();
    (produits ?? []).forEach((p: { nom: string; categorie: string }) => {
      catMap.set(p.nom.toLowerCase().trim(), p.categorie);
    });
    produitsNoms.forEach(nom => {
      const k = nom.toLowerCase().trim();
      categories[nom] = catMap.get(k) ?? guessCategorie(nom);
    });
  }

  return { commandes, fournNames, categories };
}

export function fournIdOf(c: Commande): string {
  return c.fournisseur_id ?? c.fournisseur_externe_id ?? "";
}

// Net amount = montant_total - avoir accepté, 0 si annulée
export function montantNet(c: Commande): number {
  if (c.statut === "annulee") return 0;
  const avoir = c.avoir_statut === "accepte" ? Number(c.avoir_montant ?? 0) : 0;
  return Math.max(0, Number(c.montant_total) - avoir);
}

export function fmt(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map(r => r.map(c => {
    const s = String(c);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
