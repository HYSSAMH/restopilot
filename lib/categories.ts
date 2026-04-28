/**
 * Taxonomie des catégories de produits / factures.
 *
 * Format hiérarchique slash-séparé : "parent/sub".
 * Le filtrage par parent se fait via LIKE 'parent/%' en SQL ou
 * .startsWith('parent/') côté client.
 */

export const CATEGORIES = [
  // ─── Alimentaire ─────────────────────────────────────────────
  { id: "alimentaire/boucherie",     parent: "alimentaire", label: "Boucherie",       icon: "🥩" },
  { id: "alimentaire/poissonnerie",  parent: "alimentaire", label: "Poissonnerie",    icon: "🐟" },
  { id: "alimentaire/fruits",        parent: "alimentaire", label: "Fruits",          icon: "🍎" },
  { id: "alimentaire/legumes",       parent: "alimentaire", label: "Légumes",         icon: "🥕" },
  { id: "alimentaire/epicerie",      parent: "alimentaire", label: "Épicerie",        icon: "🥫" },
  { id: "alimentaire/cremerie",      parent: "alimentaire", label: "Crémerie",        icon: "🧀" },
  { id: "alimentaire/boulangerie",   parent: "alimentaire", label: "Boulangerie",     icon: "🥖" },
  { id: "alimentaire/boissons",      parent: "alimentaire", label: "Boissons",        icon: "🥤" },

  // ─── Emballage ───────────────────────────────────────────────
  { id: "emballage",                 parent: "emballage",            label: "Emballage",         icon: "📦" },

  // ─── Produits d'entretien ───────────────────────────────────
  { id: "produits_entretien",        parent: "produits_entretien",   label: "Produits d'entretien", icon: "🧽" },

  // ─── Énergie ─────────────────────────────────────────────────
  { id: "energie/gaz",               parent: "energie",      label: "Gaz",             icon: "🔥" },
  { id: "energie/electricite",       parent: "energie",      label: "Électricité",     icon: "⚡" },
  { id: "energie/eau",               parent: "energie",      label: "Eau",             icon: "💧" },
  { id: "energie/carburant",         parent: "energie",      label: "Carburant",       icon: "⛽" },

  // ─── Matériel & équipement ───────────────────────────────────
  { id: "materiel",                  parent: "materiel",     label: "Matériel",        icon: "🔧" },

  // ─── Services ────────────────────────────────────────────────
  { id: "services",                  parent: "services",     label: "Services",        icon: "🛠️" },

  // ─── Autres ──────────────────────────────────────────────────
  { id: "autres",                    parent: "autres",       label: "Autres",          icon: "📁" },
] as const;

export type CategorieId = typeof CATEGORIES[number]["id"];

/**
 * Liste des parents distincts dans l'ordre d'affichage.
 */
export const CATEGORIES_PARENTS = Array.from(new Set(CATEGORIES.map(c => c.parent)));

/**
 * Métadonnées par id (lookup rapide).
 */
const BY_ID: Record<string, { id: string; parent: string; label: string; icon: string }> = {};
for (const c of CATEGORIES) BY_ID[c.id] = c;

export function getCategorieMeta(id: string | null | undefined) {
  if (!id) return null;
  return BY_ID[id] ?? null;
}

export function categorieLabel(id: string | null | undefined): string {
  const m = getCategorieMeta(id);
  return m ? m.label : "—";
}

export function categorieParent(id: string | null | undefined): string | null {
  const m = getCategorieMeta(id);
  return m ? m.parent : null;
}

export function categorieIcon(id: string | null | undefined): string {
  const m = getCategorieMeta(id);
  return m ? m.icon : "📁";
}

// ─── Mots-clés pour la classification automatique ──────────────

/**
 * Pour chaque catégorie, liste de mots-clés (déjà en lower-case et
 * sans accents importants, mais on lowercase à l'analyse). L'ordre
 * compte : on évalue les catégories les plus spécifiques avant les
 * plus génériques.
 */
const KW: { cat: CategorieId; kws: string[] }[] = [
  // BOUCHERIE
  { cat: "alimentaire/boucherie", kws: [
    "boeuf","bœuf","veau","agneau","porc","poulet","volaille","charcuterie","jambon",
    "saucisse","saucisson","côte","cote","entrecote","entrecôte","filet","escalope",
    "dinde","canard","rumsteck","bavette","lardon","chorizo","merguez","bacon","steak",
    "côtelette","cotelette","pâté","pate","mortadelle","rosbif","carpaccio","kefta",
    "tartare","pavé","pave","blanc de poulet","cuisse","aiguillette","gigot","chipolata",
  ] },

  // POISSONNERIE
  { cat: "alimentaire/poissonnerie", kws: [
    "poisson","saumon","cabillaud","thon","crevette","langoustine","huitre","huître",
    "moule","bar","dorade","sole","lotte","crustace","crustacé","bulot","calamar",
    "encornet","sardine","maquereau","truite","raie","seiche","palourde","oursin",
    "homard","crabe","tourteau","poulpe","anchois","julienne","colin","lieu","merlu",
    "églefin","eglefin","saint-jacques","st jacques",
  ] },

  // FRUITS
  { cat: "alimentaire/fruits", kws: [
    "pomme","poire","banane","orange","citron","fraise","framboise","raisin","cerise",
    "peche","pêche","abricot","ananas","mangue","kiwi","melon","pasteque","pastèque",
    "myrtille","mure","mûre","groseille","grenade","fruit","datte","figue","clementine","clémentine",
    "mandarine","prune","pamplemousse","papaye","goyave","litchi","fruits rouges",
  ] },

  // LÉGUMES (et féculents) — pomme de terre est rangée ici aussi
  { cat: "alimentaire/legumes", kws: [
    "tomate","courgette","aubergine","poivron","oignon","ail","carotte","poireau",
    "haricot","champignon","epinard","épinard","brocoli","chou","concombre","radis",
    "betterave","salade","laitue","roquette","mesclun","scarole","mache","mâche",
    "frisee","frisée","endive","persil","basilic","menthe","ciboulette","coriandre",
    "thym","romarin","estragon","aneth","sauge","origan","artichaut","navet","celeri",
    "céleri","fenouil","panais","topinambour","echalote","échalote","piment","paprika",
    "patate","grenaille","charlotte","agria","bintje","pomme de terre","pdt",
    "courge","potiron","butternut","mais","maïs","fève","feve","petit pois",
  ] },

  // ÉPICERIE (sec, conserves, condiments, huiles…)
  { cat: "alimentaire/epicerie", kws: [
    "huile","olive","tournesol","colza","sesame","sésame","vinaigre","sel","sucre",
    "farine","semoule","pates","pâtes","spaghetti","penne","riz","quinoa","boulgour",
    "lentille","pois chiche","conserve","sauce","ketchup","mayonnaise","moutarde",
    "harissa","curry","cumin","cannelle","poivre","épice","epice","cube","bouillon",
    "miel","confiture","biscuit","gateau","gâteau","chocolat","cacao","cafe","café",
    "thé","the","tisane","sirop","aperitif","apéritif","houmous","tahin","olives",
    "cornichon","tapenade","pesto","ketchap","worcestershire","soja","glucose","rice","pasta",
  ] },

  // CRÉMERIE
  { cat: "alimentaire/cremerie", kws: [
    "lait","beurre","creme","crème","fromage","yaourt","oeuf","œuf","camembert",
    "comte","comté","mozzarella","parmesan","gruyere","gruyère","cheddar","feta",
    "brie","reblochon","ricotta","mascarpone","emmental","raclette","chevre","chèvre",
    "fromage blanc","faisselle","kiri","babybel","président","president",
  ] },

  // BOULANGERIE
  { cat: "alimentaire/boulangerie", kws: [
    "pain","baguette","brioche","croissant","viennoiserie","focaccia","fougasse",
    "ciabatta","panini","tartelette","tarte","macaron","muffin","cake","sandwich",
    "pita","tortilla","wrap","bagel","pizza pâte","pizza pate","pâte à pizza",
  ] },

  // BOISSONS
  { cat: "alimentaire/boissons", kws: [
    "eau","cristaline","evian","vittel","perrier","badoit","san pellegrino",
    "soda","coca","cola","pepsi","fanta","oasis","sprite","schweppes","ice tea",
    "lipton","orangina","limonade","jus","biere","bière","heineken","kronenbourg",
    "vin","champagne","cremant","crémant","cidre","mojito","tropical","redbull",
    "monster","red bull","bull","cidre","tonic",
  ] },

  // ÉNERGIE / GAZ
  { cat: "energie/gaz", kws: [
    "bouteille de gaz","bouteille gaz","propane","butane","gpl","cube gaz",
    "gaz naturel","gaz","calor","antargaz","totalenergies gaz","engie gaz",
  ] },

  // ÉNERGIE / ÉLECTRICITÉ
  { cat: "energie/electricite", kws: [
    "electricite","électricité","kwh","abonnement edf","facture electricite",
    "facture électricité","endesa","enedis","totalenergies elec","engie elec",
    "consommation electrique","cpe","tarif bleu","tarif vert","tarif jaune",
  ] },

  // ÉNERGIE / EAU
  { cat: "energie/eau", kws: [
    "veolia","suez","saur","facture eau","abonnement eau","m3 eau",
    "consommation eau","assainissement",
  ] },

  // ÉNERGIE / CARBURANT
  { cat: "energie/carburant", kws: [
    "essence","diesel","gazole","gnr","carburant","sp95","sp98","gas-oil",
    "station-service","total energies station","carburant pro",
  ] },

  // EMBALLAGE
  { cat: "emballage", kws: [
    "sac","sachet","carton","boite","boîte","barquette","film","alu","alimentaire film",
    "stretch","cellophane","pochette","emballage","caisse","gobelet","verre carton",
    "vaisselle jetable","plateau","couvert","fourchette","cuillere","cuillère",
    "couteau plast","serviette papier","papier essuie-tout","essuie tout","papier alu",
    "papier cuisson","papier sulfurise","papier sulfurisé","kraft","ficelle",
    "ruban adhesif","scotch","etiquette","étiquette","film alimentaire","sopalin",
  ] },

  // PRODUITS D'ENTRETIEN
  { cat: "produits_entretien", kws: [
    "lessive","javel","detartrant","détartrant","produit vaisselle","liquide vaisselle",
    "degraissant","dégraissant","desinfectant","désinfectant","savon","gel hydroalcool",
    "essuie main","papier toilette","balai","serpilliere","serpillière","eponge","éponge",
    "torchon","gants","chiffon","detergent","détergent","ammoniac","white spirit",
    "produit sol","produit four","entretien","nettoyant","cire","poubelle","sac poubelle",
  ] },

  // MATÉRIEL & ÉQUIPEMENT
  { cat: "materiel", kws: [
    "couteau","casserole","poele","poêle","spatule","mixeur","blender","robot",
    "balance","four","frigo","réfrigérateur","refrigerateur","plaque","piano",
    "fouet","passoire","ecumoire","écumoire","planche","support","etagere","étagère",
    "chaise","table","banc","mobilier","luminaire","ampoule","peinture","mastic",
    "outillage","tournevis","perceuse","clou","vis","boulon","scie","marteau","forêt","foret",
    "balance vrac","caisse enregistreuse","ordinateur","tablette","imprimante",
  ] },

  // SERVICES (livraison, abonnements logiciels, comm., plateformes)
  { cat: "services", kws: [
    "uber","deliveroo","just eat","doordash","commission","abonnement","frais de service",
    "livraison","stripe","sumup","tpe","internet","telephone","téléphone","forfait",
    "assurance","mutuelle","banque","comptable","expert comptable","loyer","loyer commercial",
    "menage","ménage","blanchisserie","linge","initial","pressing","entretien climatisation",
    "extincteur","maintenance","reparation","réparation","mise en place","abonn",
  ] },
];

/**
 * Classification d'un nom de produit. Retourne l'id complet
 * "parent/sub" (ou "parent" pour les catégories sans sous-niveau).
 *
 * Heuristique : on cherche le premier mot-clé qui correspond. Les
 * catégories les plus spécifiques (boucherie, poissonnerie…) sont
 * évaluées avant les plus génériques (épicerie, services).
 */
export function classifierProduit(nom: string | null | undefined): CategorieId {
  if (!nom) return "autres";
  const n = nom.toLowerCase();
  for (const { cat, kws } of KW) {
    if (kws.some(k => n.includes(k))) return cat;
  }
  return "autres";
}

/**
 * Catégorie dominante d'une facture : si une catégorie représente
 * ≥ 70 % du HT total des lignes, on la retourne. Sinon "mixte" ou
 * "alimentaire" (si majoritairement alimentaire toutes sous-cats
 * confondues).
 */
export function dominantCategorie(
  lignes: { categorie?: string | null; total?: number | null; quantite?: number | null; prix_unitaire?: number | null }[],
): string | null {
  if (!lignes || lignes.length === 0) return null;

  // Calcul du HT par catégorie ET par parent
  const byCat = new Map<string, number>();
  const byParent = new Map<string, number>();
  let total = 0;
  for (const l of lignes) {
    const ht = (l.total != null && l.total !== 0)
      ? Number(l.total)
      : Number(l.quantite ?? 0) * Number(l.prix_unitaire ?? 0);
    const cat = l.categorie || "autres";
    const parent = cat.includes("/") ? cat.split("/")[0] : cat;
    byCat.set(cat, (byCat.get(cat) ?? 0) + ht);
    byParent.set(parent, (byParent.get(parent) ?? 0) + ht);
    total += ht;
  }
  if (total === 0) return null;

  // Si une sous-catégorie dépasse 70 %, on la retourne
  for (const [cat, sum] of byCat.entries()) {
    if (sum / total >= 0.7) return cat;
  }
  // Sinon, si un parent dépasse 70 %, on retourne le parent
  for (const [parent, sum] of byParent.entries()) {
    if (sum / total >= 0.7) return parent;
  }
  // Sinon, mixte
  return "mixte";
}
