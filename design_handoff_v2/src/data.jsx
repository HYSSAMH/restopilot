// RestoPilot — Shared data for Maison Lumière (resto gastro parisien fictif)

const SUPPLIERS = {
  halles: { id: 'halles', name: 'Grossiste Lyon Halles', short: 'Lyon Halles', color: '#6366F1', rating: 4.8, delivery: 'Demain' },
  maree:  { id: 'maree',  name: 'Marée Atlantique', short: 'Marée Atl.', color: '#0EA5E9', rating: 4.6, delivery: 'J+1 avant 6h' },
  terroir:{ id: 'terroir',name: 'Terroir Direct', short: 'Terroir',     color: '#10B981', rating: 4.9, delivery: 'Jeudi' },
  boucher:{ id: 'boucher',name: 'Boucherie Dumas',  short: 'Dumas',      color: '#EF4444', rating: 4.7, delivery: 'Demain' },
  vin:    { id: 'vin',    name: 'Cave des Sommeliers', short: 'Cave',    color: '#8B5CF6', rating: 4.5, delivery: '48h' },
  epicerie:{id: 'epicerie',name:'Épicerie Fine Rungis', short: 'Rungis', color: '#F59E0B', rating: 4.4, delivery: 'Demain' },
};

const CATEGORIES = [
  { id: 'all',      name: 'Tous les produits', count: 1284 },
  { id: 'legumes',  name: 'Fruits & légumes',  count: 312 },
  { id: 'viandes',  name: 'Viandes',            count: 186 },
  { id: 'poissons', name: 'Poissons & fruits de mer', count: 94 },
  { id: 'cremerie', name: 'Crémerie & œufs',   count: 148 },
  { id: 'epicerie', name: 'Épicerie sèche',     count: 421 },
  { id: 'boulangerie', name: 'Boulangerie',     count: 67 },
  { id: 'boissons', name: 'Boissons & vins',    count: 156 },
];

const PRODUCTS = [
  {
    id: 'p1', name: 'Saint-Jacques fraîches', category: 'poissons',
    meta: 'Noix · Calibre 20/30 · Pêche Normandie', unit: 'kg',
    badge: 'best-price', prev: 68.40,
    prices: [
      { supplier: 'maree',   price: 54.80, stock: 'En stock', pack: 'Colis 3 kg' },
      { supplier: 'halles',  price: 58.20, stock: 'En stock', pack: 'Colis 5 kg' },
      { supplier: 'epicerie',price: 62.00, stock: 'Sur commande', pack: 'kg' },
    ],
  },
  {
    id: 'p2', name: 'Filet de bœuf Limousin', category: 'viandes',
    meta: 'Race pure · Maturation 21j · Label Rouge', unit: 'kg',
    badge: 'new',
    prices: [
      { supplier: 'boucher', price: 48.90, stock: 'En stock', pack: 'Pièce 2-3 kg' },
      { supplier: 'halles',  price: 52.40, stock: 'En stock', pack: 'kg' },
      { supplier: 'terroir', price: 51.20, stock: 'Stock faible', pack: 'Pièce 2.5 kg' },
    ],
  },
  {
    id: 'p3', name: 'Asperges blanches', category: 'legumes',
    meta: 'Calibre 22+ · Bio · Landes', unit: 'botte 500g',
    badge: 'promo', prev: 9.80,
    prices: [
      { supplier: 'terroir', price: 7.40, stock: 'En stock', pack: 'Carton 5 kg' },
      { supplier: 'halles',  price: 8.20, stock: 'En stock', pack: 'kg' },
    ],
  },
  {
    id: 'p4', name: 'Beurre AOP Charentes-Poitou', category: 'cremerie',
    meta: 'Doux · Plaque 1 kg · AOP', unit: 'kg',
    prices: [
      { supplier: 'halles',  price: 12.60, stock: 'En stock', pack: 'Colis 10 kg' },
      { supplier: 'terroir', price: 13.20, stock: 'En stock', pack: 'Plaque 1 kg' },
      { supplier: 'epicerie',price: 14.10, stock: 'En stock', pack: 'Plaque 1 kg' },
    ],
  },
  {
    id: 'p5', name: 'Homard breton vivant', category: 'poissons',
    meta: 'Calibre 500-600g · Pêche côtière', unit: 'pièce',
    prices: [
      { supplier: 'maree',   price: 36.00, stock: 'En stock', pack: 'Pièce' },
      { supplier: 'halles',  price: 39.50, stock: 'Sur commande', pack: 'Pièce' },
    ],
  },
  {
    id: 'p6', name: 'Truffe noire Périgord', category: 'legumes',
    meta: 'Tuber melanosporum · 1ère qualité', unit: '100g',
    badge: 'season',
    prices: [
      { supplier: 'terroir', price: 98.00, stock: 'En stock', pack: '100g' },
      { supplier: 'epicerie',price: 112.00, stock: 'En stock', pack: '50g / 100g' },
    ],
  },
  {
    id: 'p7', name: 'Huile d\u2019olive Taggiasca', category: 'epicerie',
    meta: 'Extra vierge · Ligurie · Récolte 2025', unit: 'L',
    prices: [
      { supplier: 'epicerie',price: 18.40, stock: 'En stock', pack: 'Bidon 5L' },
      { supplier: 'halles',  price: 19.80, stock: 'En stock', pack: 'Bouteille 1L' },
    ],
  },
  {
    id: 'p8', name: 'Œufs bio fermiers', category: 'cremerie',
    meta: 'Cat. A · Cal. moyen · Plateau 180', unit: 'plateau',
    prices: [
      { supplier: 'terroir', price: 32.00, stock: 'En stock', pack: 'Plateau 180' },
      { supplier: 'halles',  price: 34.50, stock: 'En stock', pack: 'Plateau 180' },
    ],
  },
  {
    id: 'p9', name: 'Farine T55 Tradition', category: 'epicerie',
    meta: 'Moulin à meule · Sans additif', unit: 'sac 25kg',
    prices: [
      { supplier: 'halles',  price: 22.80, stock: 'En stock', pack: 'Sac 25 kg' },
      { supplier: 'epicerie',price: 24.40, stock: 'En stock', pack: 'Sac 25 kg' },
    ],
  },
];

// Dashboard data
const KPIS = [
  { key: 'ca', label: 'CA du jour', value: 4286, unit: '€', delta: 12.4, dir: 'up', sub: 'vs lun. dernier', spark: [22,25,21,28,30,26,32,35,34,38,42,40,43] },
  { key: 'cm', label: 'Coût matière', value: 28.4, unit: '%', delta: -1.2, dir: 'up', sub: 'objectif 30%', spark: [32,31,30,31,29,30,28,29,28,29,28,27,28], inverse: true },
  { key: 'marge', label: 'Marge brute', value: 71.6, unit: '%', delta: 1.2, dir: 'up', sub: 'mois en cours', spark: [68,69,70,70,71,71,70,71,72,71,72,71,72] },
  { key: 'couverts', label: 'Couverts prévus', value: 82, unit: '', delta: 0, dir: 'flat', sub: 'ce soir · complet à 19h', spark: [60,65,70,68,72,75,78,80,82,85,84,82,82] },
];

const ALERTS = [
  { kind: 'danger', title: 'Beurre AOP : rupture probable', desc: 'Stock restant 3 kg · conso moyenne 4.2 kg/j. Commander avant 17h.', time: 'il y a 8 min' },
  { kind: 'warning', title: 'Prix en hausse : Saint-Jacques', desc: 'Marée Atlantique +8.2% sur 7j. Grossiste Lyon Halles reste stable.', time: 'il y a 1h' },
  { kind: 'info', title: 'Nouvelle mercuriale Terroir Direct', desc: '48 produits ajoutés · 12 en promotion cette semaine.', time: 'il y a 3h' },
  { kind: 'success', title: 'Facture BOU-2024-1082 réglée', desc: 'Boucherie Dumas · 842.60 € · virement reçu.', time: 'hier' },
  { kind: 'warning', title: 'Marge Saint-Jacques rôties < objectif', desc: 'Coût matière à 34% (objectif 30%). Ajuster prix ou portion.', time: 'hier' },
];

const RECENT_ORDERS = [
  { id: 'CMD-2614', supplier: 'halles', date: '22 avr.', items: 18, amount: 612.40, status: 'delivered' },
  { id: 'CMD-2613', supplier: 'maree', date: '22 avr.', items: 6, amount: 284.00, status: 'shipping' },
  { id: 'CMD-2612', supplier: 'terroir', date: '21 avr.', items: 24, amount: 498.20, status: 'pending' },
  { id: 'CMD-2611', supplier: 'boucher', date: '21 avr.', items: 8, amount: 842.60, status: 'delivered' },
  { id: 'CMD-2610', supplier: 'vin', date: '20 avr.', items: 12, amount: 1240.00, status: 'delivered' },
];

// Sales by category (last 7 days, for mini chart)
const WEEK_SALES = [
  { day: 'Mar',  ca: 3820, cm: 29 },
  { day: 'Mer',  ca: 4120, cm: 28 },
  { day: 'Jeu',  ca: 4480, cm: 29 },
  { day: 'Ven',  ca: 5280, cm: 27 },
  { day: 'Sam',  ca: 6140, cm: 28 },
  { day: 'Dim',  ca: 3280, cm: 30 },
  { day: 'Lun',  ca: 4286, cm: 28 },
];

// Fiche technique — Saint-Jacques rôties, topinambours, beurre noisette
const FICHE = {
  name: 'Saint-Jacques rôties, topinambour & beurre noisette',
  category: 'Entrée', portions: 1, weight: 180, service: 'À l\u2019assiette', allergens: ['Mollusques', 'Lait'],
  ingredients: [
    { id: 'i1', name: 'Saint-Jacques fraîches (noix)', qty: 0.120, unit: 'kg', cost: 54.80, supplier: 'maree' },
    { id: 'i2', name: 'Topinambours', qty: 0.150, unit: 'kg', cost: 4.20, supplier: 'terroir' },
    { id: 'i3', name: 'Beurre AOP Charentes', qty: 0.040, unit: 'kg', cost: 12.60, supplier: 'halles' },
    { id: 'i4', name: 'Huile de noisette', qty: 0.010, unit: 'L', cost: 24.00, supplier: 'epicerie' },
    { id: 'i5', name: 'Noisettes torréfiées', qty: 0.015, unit: 'kg', cost: 18.50, supplier: 'epicerie' },
    { id: 'i6', name: 'Fleur de sel Guérande', qty: 0.002, unit: 'kg', cost: 24.00, supplier: 'epicerie' },
  ],
  subRecipes: [
    { id: 's1', name: 'Vinaigrette agrumes', qty: 0.020, unit: 'L', cost: 8.40, items: [
      { name: 'Jus d\u2019orange frais', qty: 0.008, unit: 'L', cost: 4.20 },
      { name: 'Huile d\u2019olive Taggiasca', qty: 0.006, unit: 'L', cost: 18.40 },
      { name: 'Vinaigre de Xérès', qty: 0.004, unit: 'L', cost: 12.00 },
    ]},
  ],
};

window.SUPPLIERS = SUPPLIERS;
window.CATEGORIES = CATEGORIES;
window.PRODUCTS = PRODUCTS;
window.KPIS = KPIS;
window.ALERTS = ALERTS;
window.RECENT_ORDERS = RECENT_ORDERS;
window.WEEK_SALES = WEEK_SALES;
window.FICHE = FICHE;
