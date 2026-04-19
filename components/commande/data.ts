// Types partagés du module "passer une commande".
// Tous les anciens seed (PRODUITS, MINIMUMS hardcodés) ont été supprimés :
// le catalogue réel vient désormais uniquement de Supabase (tarifs + profiles).

export type Categorie =
  | "legumes"
  | "fruits"
  | "boucherie"
  | "poissonnerie"
  | "epicerie"
  | "herbes"
  | "pommes_de_terre"
  | "salades"
  | "cremerie";

export type FournisseurOption = {
  id: string;
  nom: string;
  initiale: string;
  avatar: string; // tailwind gradient classes
  prix: number;
  unite: string;
  minimum: number;
  delai: string;
  note: number;
  badge?: "nouveaute" | "prix_baisse" | "promotion" | null;
  badge_expires_at?: string | null;
  ancien_prix?: number | null;
};

export type Produit = {
  id: string;
  nom: string;
  categorie: Categorie;
  icone: string;
  description: string;
  photos?: string[];
  fournisseurs: FournisseurOption[];
};

export type CartEntry = {
  produit: Produit;
  fournisseur: FournisseurOption;
  qty: number;
};

export type CartMap = Record<string, CartEntry>;

export const CATEGORIES: { id: Categorie | "tous"; label: string; icone: string }[] = [
  { id: "tous",         label: "Tous",             icone: "🛒" },
  { id: "legumes",      label: "Fruits & Légumes", icone: "🥬" },
  { id: "fruits",       label: "Fruits",           icone: "🍓" },
  { id: "boucherie",    label: "Boucherie",        icone: "🥩" },
  { id: "poissonnerie", label: "Poissonnerie",     icone: "🐟" },
  { id: "epicerie",     label: "Épicerie",         icone: "🫙" },
];
