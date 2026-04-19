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
  fournisseurs: FournisseurOption[];
};

export type CartEntry = {
  produit: Produit;
  fournisseur: FournisseurOption;
  qty: number;
};

export type CartMap = Record<string, CartEntry>;

export const CATEGORIES: { id: Categorie | "tous"; label: string; icone: string }[] = [
  { id: "tous",         label: "Tous",            icone: "🛒" },
  { id: "legumes",      label: "Fruits & Légumes", icone: "🥬" },
  { id: "fruits",       label: "Fruits",           icone: "🍓" },
  { id: "boucherie",    label: "Boucherie",        icone: "🥩" },
  { id: "poissonnerie", label: "Poissonnerie",     icone: "🐟" },
  { id: "epicerie",     label: "Épicerie",         icone: "🫙" },
];

// Minimums de commande par fournisseur (centralisé)
export const MINIMUMS: Record<string, number> = {
  "profrais":   200,
  "freshmarket":150,
  "rungis":     250,
  "metro":      300,
  "aquamer":    100,
};

export const PRODUITS: Produit[] = [
  // ── Légumes ──────────────────────────────────────────────────────────────
  {
    id: "tomates-cerises",
    nom: "Tomates cerises",
    categorie: "legumes",
    icone: "🍅",
    description: "Barquette 500 g · Origine France",
    fournisseurs: [
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500",  prix: 7.20, unite: "barq.", minimum: 30, delai: "J+1", note: 4.8 },
      { id: "freshmarket",nom: "FreshMarket Pro",        initiale: "F", avatar: "from-blue-600 to-cyan-400",     prix: 7.90, unite: "barq.", minimum: 20, delai: "J+2", note: 4.5 },
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 8.20, unite: "barq.", minimum: 40, delai: "J+1", note: 4.3 },
    ],
  },
  {
    id: "courgettes",
    nom: "Courgettes",
    categorie: "legumes",
    icone: "🥒",
    description: "Vrac · calibre moyen · Origine Espagne",
    fournisseurs: [
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 3.40, unite: "kg",    minimum: 35, delai: "J+1", note: 4.7 },
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 3.60, unite: "kg",    minimum: 40, delai: "J+1", note: 4.3 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 3.80, unite: "kg",    minimum: 30, delai: "J+2", note: 4.8 },
    ],
  },
  {
    id: "salade-verte",
    nom: "Salade batavia",
    categorie: "legumes",
    icone: "🥗",
    description: "Pièce entière · Origine France",
    fournisseurs: [
      { id: "freshmarket",nom: "FreshMarket Pro",        initiale: "F", avatar: "from-blue-600 to-cyan-400",     prix: 2.10, unite: "pièce", minimum: 20, delai: "J+1", note: 4.5 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 2.40, unite: "pièce", minimum: 30, delai: "J+2", note: 4.8 },
    ],
  },
  {
    id: "champignons",
    nom: "Champignons de Paris",
    categorie: "legumes",
    icone: "🍄",
    description: "Vrac · boutons blancs · Origine France",
    fournisseurs: [
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 5.40, unite: "kg",    minimum: 35, delai: "J+1", note: 4.7 },
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 5.90, unite: "kg",    minimum: 40, delai: "J+1", note: 4.3 },
    ],
  },
  // ── Fruits ───────────────────────────────────────────────────────────────
  {
    id: "fraises",
    nom: "Fraises Gariguette",
    categorie: "fruits",
    icone: "🍓",
    description: "Barquette 500 g · Origine Périgord",
    fournisseurs: [
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 11.80, unite: "kg",   minimum: 35, delai: "J+1", note: 4.7 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 12.50, unite: "kg",   minimum: 30, delai: "J+2", note: 4.8 },
      { id: "freshmarket",nom: "FreshMarket Pro",       initiale: "F", avatar: "from-blue-600 to-cyan-400",     prix: 13.20, unite: "kg",   minimum: 20, delai: "J+2", note: 4.5 },
    ],
  },
  {
    id: "citrons",
    nom: "Citrons bio",
    categorie: "fruits",
    icone: "🍋",
    description: "Filet 1 kg · Origine Sicile",
    fournisseurs: [
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 4.20, unite: "kg",    minimum: 35, delai: "J+1", note: 4.7 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 4.50, unite: "kg",    minimum: 30, delai: "J+2", note: 4.8 },
    ],
  },
  // ── Boucherie ────────────────────────────────────────────────────────────
  {
    id: "entrecote",
    nom: "Entrecôte de bœuf",
    categorie: "boucherie",
    icone: "🥩",
    description: "Charolaise · maturée 21 jours · pièce ≈ 250 g",
    fournisseurs: [
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 34.00, unite: "kg",   minimum: 30, delai: "J+2", note: 4.8 },
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 36.00, unite: "kg",   minimum: 35, delai: "J+1", note: 4.7 },
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 37.50, unite: "kg",   minimum: 40, delai: "J+1", note: 4.3 },
    ],
  },
  {
    id: "poulet",
    nom: "Poulet fermier",
    categorie: "boucherie",
    icone: "🍗",
    description: "Label Rouge · entier ou en découpe",
    fournisseurs: [
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 8.40, unite: "kg",    minimum: 40, delai: "J+1", note: 4.3 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 8.90, unite: "kg",    minimum: 30, delai: "J+2", note: 4.8 },
      { id: "freshmarket",nom: "FreshMarket Pro",       initiale: "F", avatar: "from-blue-600 to-cyan-400",     prix: 9.60, unite: "kg",    minimum: 20, delai: "J+2", note: 4.5 },
    ],
  },
  {
    id: "agneau",
    nom: "Côtes d'agneau",
    categorie: "boucherie",
    icone: "🫀",
    description: "Agneau du Quercy · côtelettes premières",
    fournisseurs: [
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 22.00, unite: "kg",   minimum: 35, delai: "J+1", note: 4.7 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 24.50, unite: "kg",   minimum: 30, delai: "J+2", note: 4.8 },
    ],
  },
  // ── Poissonnerie ─────────────────────────────────────────────────────────
  {
    id: "saumon",
    nom: "Saumon atlantique",
    categorie: "poissonnerie",
    icone: "🐟",
    description: "Filets · Écosse · pêche durable MSC",
    fournisseurs: [
      { id: "aquamer",    nom: "AquaMer Pêche",         initiale: "A", avatar: "from-sky-600 to-blue-400",      prix: 43.50, unite: "kg",   minimum: 25, delai: "J+1", note: 4.9 },
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 45.80, unite: "kg",   minimum: 35, delai: "J+1", note: 4.7 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 47.00, unite: "kg",   minimum: 30, delai: "J+2", note: 4.8 },
    ],
  },
  {
    id: "cabillaud",
    nom: "Cabillaud",
    categorie: "poissonnerie",
    icone: "🐠",
    description: "Dos de cabillaud · Atlantique Nord",
    fournisseurs: [
      { id: "aquamer",    nom: "AquaMer Pêche",         initiale: "A", avatar: "from-sky-600 to-blue-400",      prix: 28.00, unite: "kg",   minimum: 25, delai: "J+1", note: 4.9 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 31.00, unite: "kg",   minimum: 30, delai: "J+2", note: 4.8 },
    ],
  },
  {
    id: "crevettes",
    nom: "Crevettes tigrées",
    categorie: "poissonnerie",
    icone: "🦐",
    description: "Décortiquées · calibre 21/25 · surgelées",
    fournisseurs: [
      { id: "aquamer",    nom: "AquaMer Pêche",         initiale: "A", avatar: "from-sky-600 to-blue-400",      prix: 18.50, unite: "kg",   minimum: 25, delai: "J+1", note: 4.9 },
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 19.80, unite: "kg",   minimum: 35, delai: "J+1", note: 4.7 },
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 20.40, unite: "kg",   minimum: 40, delai: "J+1", note: 4.3 },
    ],
  },
  // ── Épicerie ─────────────────────────────────────────────────────────────
  {
    id: "huile-olive",
    nom: "Huile d'olive EV",
    categorie: "epicerie",
    icone: "🫒",
    description: "Extra vierge · première pression · bidon 5 L",
    fournisseurs: [
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 26.00, unite: "L",    minimum: 40, delai: "J+1", note: 4.3 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 29.50, unite: "L",    minimum: 30, delai: "J+2", note: 4.8 },
      { id: "freshmarket",nom: "FreshMarket Pro",       initiale: "F", avatar: "from-blue-600 to-cyan-400",     prix: 31.00, unite: "L",    minimum: 20, delai: "J+2", note: 4.5 },
    ],
  },
  {
    id: "farine",
    nom: "Farine T55",
    categorie: "epicerie",
    icone: "🌾",
    description: "Sac 25 kg · Minoterie Française",
    fournisseurs: [
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 18.80, unite: "kg",   minimum: 40, delai: "J+1", note: 4.3 },
      { id: "profrais",   nom: "ProFrais Distribution", initiale: "P", avatar: "from-violet-600 to-purple-500", prix: 21.00, unite: "kg",   minimum: 30, delai: "J+2", note: 4.8 },
    ],
  },
  {
    id: "fleur-sel",
    nom: "Fleur de sel",
    categorie: "epicerie",
    icone: "🧂",
    description: "Guérande AOC · boîte 1 kg",
    fournisseurs: [
      { id: "rungis",     nom: "Rungis Express",        initiale: "R", avatar: "from-emerald-600 to-teal-400",  prix: 6.80, unite: "kg",    minimum: 35, delai: "J+1", note: 4.7 },
      { id: "metro",      nom: "Métro Cash & Carry",    initiale: "M", avatar: "from-orange-500 to-amber-400",  prix: 7.50, unite: "kg",    minimum: 40, delai: "J+1", note: 4.3 },
    ],
  },
];
