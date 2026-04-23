# Handoff — RestoPilot

> SaaS de pilotage pour restaurateurs indépendants (gestion achats, commandes, coût matière, trésorerie).
> Public cible : gérants de restaurants gastronomiques / bistronomiques (1 à 3 établissements). Persona-type : "Julien Mercier" — propriétaire-gérant de _Maison Lumière_ (Paris).

---

## ⚠️ À lire en premier

Les fichiers dans `src/` sont des **prototypes de design réalisés en HTML + React inline (via Babel Standalone)**. Ce sont des références visuelles et interactives, **pas du code de production**.

**La mission** : **recréer ces designs dans l'environnement cible** (le codebase du projet) en respectant ses conventions (framework, librairie UI, gestion d'état, routing, build). Si le projet n'a pas encore d'environnement, choisir la stack la plus adaptée (recommandation : **Next.js App Router + TypeScript + TailwindCSS + shadcn/ui + TanStack Query**). Ne pas copier-coller le JSX tel quel.

---

## Fidélité

**High-fidelity (hifi).** Les maquettes sont pixel-perfect : couleurs, typographie, espacements, interactions, animations finales. Le dev doit reproduire fidèlement l'apparence, puis câbler aux vraies données.

---

## Sommaire

1. [Architecture du prototype](#architecture-du-prototype)
2. [Design tokens](#design-tokens)
3. [Typographie](#typographie)
4. [Système de composants partagés](#système-de-composants-partagés)
5. [Écrans livrés](#écrans-livrés)
6. [Interactions & navigations](#interactions--navigations)
7. [État & données](#état--données)
8. [Accessibilité & responsive](#accessibilité--responsive)
9. [Fichiers](#fichiers)

---

## Architecture du prototype

```
src/
├── index.html              ← entry point (charge tous les scripts Babel)
├── styles.css              ← 2900+ lignes, toutes les styles (tokens + composants + pages)
├── app.jsx                 ← router maison (switch/case sur `page` state)
├── shell.jsx               ← App shell : topbar + sidebar (Sidebar, TopBar, breadcrumbs)
├── data.jsx                ← données mock globales (SUPPLIERS, PRODUCTS, CATEGORIES)
├── icons.jsx               ← <Icon name="..."/> — set Lucide, ~100 icônes inline en SVG
├── tweaks-panel.jsx        ← helper : panneau de tweaks (densité, couleur d'accent, etc.)
│
├── dashboard.jsx           ← Dashboard restaurateur
├── catalogue.jsx           ← Passer une commande (catalogue multi-fournisseurs)
├── fiche.jsx               ← Fiches techniques (coût de revient recette)
├── mercuriale.jsx          ← Mercuriale fournisseur (tarifs, badges, import IA)
├── treso.jsx               ← Trésorerie (rapprochement bancaire)
├── mobile.jsx              ← Aperçu mobile (iOS frame)
├── ops.jsx                 ← Rôles annexes (employé saisie CA, admin, fournisseur)
├── extras.jsx              ← Pages secondaires (planning, inventaire, analytics…)
├── more.jsx                ← Pages complémentaires (onboarding, settings, menu-builder)
├── invoices.jsx            ← Factures fournisseurs
├── analytics-deep.jsx      ← Analyse prix & historique achats
├── budget-editor.jsx       ← Modal d'édition budget plein écran
│
├── receive.jsx             ← À réceptionner (liste livraisons + détail pointage)
├── orders.jsx              ← Mes commandes (historique + drawer détail)
├── suppliers.jsx           ← Fournisseurs externes (annuaire + drawer perf)
├── team.jsx                ← Équipe (membres, rôles, activité)
└── profile.jsx             ← Mon profil (identité, sécurité, préférences, notifs)
```

Chaque page JSX expose un composant `XxxPage` sur `window.*`. `app.jsx` fait un `switch` sur `page` (état local) pour afficher la bonne page.

---

## Design tokens

**Extraire depuis `src/styles.css` en haut du fichier (`:root { ... }`) :**

### Couleurs

| Token                | Valeur      | Usage                                  |
| -------------------- | ----------- | -------------------------------------- |
| `--bg`               | `#FAFAFA`   | Fond général de l'application          |
| `--bg-subtle`        | `#F4F4F5`   | Fond des inputs, zones secondaires     |
| `--border`           | `#E8E8EA`   | Bordures par défaut                    |
| `--text`             | `#0A0A0B`   | Texte principal                        |
| `--text-muted`       | `#71717A`   | Texte secondaire                       |
| `--text-subtle`      | `#A1A1AA`   | Texte tertiaire, placeholders          |
| `--accent`           | `#6366F1`   | Indigo — couleur primaire de la marque |
| `--accent-soft`      | `#EEF2FF`   | Fond léger d'accent                    |
| `--accent-dark`      | `#4F46E5`   | Hover / pressed                        |
| `--success`          | `#059669`   | Vert — validations, prix au plus bas   |
| `--success-soft`     | `#D1FAE5`   |                                        |
| `--danger`           | `#DC2626`   | Rouge — alertes, litiges, pertes       |
| `--danger-soft`      | `#FEE2E2`   |                                        |
| `--warning`          | `#D97706`   | Orange — attention, en cours           |

**Couleurs sémantiques fournisseurs** (pour badges colorés) :

| Fournisseur                | Couleur    |
| -------------------------- | ---------- |
| Grossiste Lyon Halles      | `#6366F1`  |
| Marée Atlantique           | `#0EA5E9`  |
| Terroir Direct             | `#10B981`  |
| Boucherie Dumas            | `#EF4444`  |
| Cave des Sommeliers        | `#8B5CF6`  |
| Épicerie Fine Rungis       | `#F59E0B`  |

### Espacements

Échelle Tailwind-like : `4px, 6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 24px, 32px, 40px, 48px`.

### Radius

- `7px` — inputs, boutons
- `8-10px` — cards, modales
- `12-14px` — gros containers, panneaux

### Ombres

```css
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 24px 60px -12px rgba(0, 0, 0, 0.25); /* modales */
```

---

## Typographie

- **Sans-serif** : **Inter** (via Google Fonts, weights 400/500/550/600/650/700)
- **Monospace** : **JetBrains Mono** (weights 400/500/600/700) — **utilisée massivement pour tous les chiffres, identifiants (CMD-XXXX, FA-XXXX), codes, montants, pourcentages**. C'est un trait fort du design (référence Linear / Pennylane).

**Échelle** :

| Usage              | Taille     | Weight | Letter-spacing |
| ------------------ | ---------- | ------ | -------------- |
| Page title (h1)    | 22px       | 650    | -0.02em        |
| Section title (h2) | 18px       | 650    | -0.01em        |
| Card title         | 14-15px    | 600-650| -0.01em        |
| Body               | 13px       | 400-550| normal         |
| Secondary         | 12-12.5px  | 400-550| normal         |
| Small / meta       | 11-11.5px  | 500-600| normal         |
| Uppercase label    | 10.5px     | 600-650| 0.04em         |
| Big number (KPI)   | 22-32px    | 650-700| -0.02em        |

Le texte uppercase (labels de colonnes, sections) doit TOUJOURS avoir `letter-spacing: 0.04em` et `font-weight: 650`.

---

## Système de composants partagés

### Boutons (`.btn`)

- `.btn` → secondaire, fond blanc, bordure 1px
- `.btn.primary` → indigo plein, texte blanc
- `.btn.sm` → version compacte (height 28px)
- Tous avec `Icon` à gauche possible

### Inputs
- height 34px, radius 7px, padding horizontal 10-12px
- focus : border indigo + ring 3px `--accent-soft`

### Pills / Chips de statut
Pattern `{ background: var(--X-soft), color: var(--X) }` avec un petit dot animé pour les états "en cours" (pulse 1.5s).

### Cards
- fond blanc, bordure 1px, radius 10-12px
- padding interne 14-20px

### Table
- head : fond `--bg-subtle`, labels uppercase 10.5px, letter-spacing 0.04em
- rows : bordure bas 1px, hover `--bg-subtle`, padding 14px 16px
- grid-template-columns défini par page (voir CSS)

### Sidebar
- 240px fixe, fond blanc, 3 sections (Principal / Menu / Gestion)
- items : icon 16px + label + optionnel badge count à droite
- état actif : fond `--accent-soft`, barre indigo 3px à gauche

### Drawer latéral
- slide depuis la droite, width 520-560px
- backdrop `rgba(15,15,20,0.4)` avec fadeIn 200ms
- animation `cubic-bezier(0.22, 1, 0.36, 1)` 280ms

### Modal
- centré, width 520px, radius 14px
- shadow `0 24px 60px -12px rgba(0,0,0,0.25)`

---

## Écrans livrés

### 1. Dashboard — `dashboard.jsx`
4 KPIs (CA, coût matière, marge, couverts) avec sparklines. Graphique CA 7 jours. Alertes intelligentes (prix fournisseur, stocks, litiges). Commandes récentes. Raccourcis.

### 2. Passer une commande — `catalogue.jsx`
Comparateur multi-fournisseurs. 6 fournisseurs fictifs, prix au plus bas marqué en vert. Vue grille ET vue tableau. Panier multi-fournisseurs groupé avec calcul d'économies. Badges (best-price / new / promo).

### 3. Fiche technique — `fiche.jsx`
Recette "Saint-Jacques rôties" avec ingrédients et sous-recette imbriquée. Calculateur de prix HT/TTC interactif (slider marge, TVA 5.5% / 10% / 20%). Jauge de marge visuelle. Évolution du coût de revient.

### 4. Mercuriale fournisseur — `mercuriale.jsx`
Dropzone d'import PDF avec simulation IA (5 étapes : OCR → rapprochement → détection prix → validation → création). Tableau des tarifs avec badges Nouveau/Hausse/Baisse (en %), évolution et statut de stock.

### 5. Trésorerie — `treso.jsx`
Solde bancaire (card dark hero). 3 KPIs encaissé/décaissé/net. Pointage factures ↔ relevé bancaire (drag/clic pour rapprocher). Flux de trésorerie en barres pos/neg. Masse salariale. Prélèvements à venir.

### 6. Aperçu mobile — `mobile.jsx`
Deux iPhones côte-à-côte : Dashboard mobile (hamburger + drawer + tab bar bottom) et Commander mobile (chips scrollables + cards produit compactes).

### 7. Factures — `invoices.jsx`
Gestion des factures fournisseurs (rapprochement BL ↔ facture, statut paiement).

### 8. Analytics historique & prix — `analytics-deep.jsx`
Historique d'achats, analyse des évolutions de prix.

### 9. Budget (+ éditeur modal) — `extras.jsx` + `budget-editor.jsx`
Vue budget annuelle. Bouton "Ajuster les budgets" ouvre un **modal plein écran** avec sliders, presets, simulation de marge, breakdown mensuel.

### 10. Planning / Inventaire / Menu builder — `extras.jsx` + `more.jsx`
Écrans secondaires.

### 11. À réceptionner — `receive.jsx`
**Liste des livraisons** groupée par jour (Aujourd'hui / Demain / Jeudi). 4 stats en tête. Cards fournisseur avec ETA, livreur, statut animé (pulse). Filtres.
**Détail de réception** (clic sur une livraison) : pointage ligne par ligne (input −/+, badge delta coloré, 3 actions conforme/écart/manquant). Panneau droit : récap OK/KO, calcul auto de l'avoir, relevé température HACCP, photos BL, signature livreur.

### 12. Mes commandes — `orders.jsx`
Liste dense triable. Barre de filtres tout-en-un : recherche + période + fournisseur + statut + range montant + toggle "Litiges uniquement". Table avec checkboxes, tri par date/montant, pill de statut colorée. **Drawer latéral** (520px) au clic avec : bannière contextuelle (litige/annulation), 4 cartes méta, aperçu des lignes, totaux HT/TVA/TTC, timeline horizontale du cycle de vie (Envoyée → Confirmée → En livraison → Réceptionnée). Actions : PDF bon de commande / Voir facture / Signaler litige.

### 13. Fournisseurs externes — `suppliers.jsx`
Liste triable (CA / nb cmd / ponctualité / récence). Colonne barre de ponctualité colorée. **Drawer détail** au clic : 3 KPIs (commandes, CA, panier moyen), graphique CA 12 mois, coordonnées complètes, carte "commercial attitré", 4 dernières commandes.

### 14. Équipe — `team.jsx`
3 onglets : **Membres** (cards avec avatar coloré, rôle, activité), **Rôles & permissions** (6 rôles par défaut + modal "Créer un poste personnalisé" avec checkbox permissions), **Activité** (flux d'actions).

### 15. Mon profil — `profile.jsx`
Sidebar gauche + 4 onglets : **Identité**, **Sécurité** (mot de passe, 2FA toggle, sessions actives), **Préférences** (langue, fuseau, sélecteur thème visuel clair/sombre/auto, formats), **Notifications** (matrice événements × canaux email/push avec toggles).

---

## Interactions & navigations

### Navigation principale
Sidebar fixée à gauche, bouton actif met à jour l'état `page` de `app.jsx`. Les liens internes entre pages passent par la prop `onNav(pageId)` (ex : depuis un drawer, "Voir la facture" fait `onNav('invoices')`).

### Transitions
- **Page change** : `pageEnter` animation — translateY 4px + fadeIn 300ms
- **Drawer slide** : `cubic-bezier(0.22, 1, 0.36, 1)` 280ms depuis la droite
- **Modal** : fadeIn 200ms sur backdrop + modal
- **Toggles** : 200ms ease
- **Pulse dot** (statuts en cours) : 1.5s ease-in-out infinite

### États interactifs
- **Hover row** : background `--bg-subtle`
- **Row actif (drawer ouvert)** : background `--accent-soft` + barre 3px `--accent` à gauche
- **Focus input** : border `--accent` + ring 3px `--accent-soft`

### Tweaks panel (existant)
Panneau flottant avec densité (aéré/compact), couleur d'accent (7 options), vue catalogue (grille/tableau). À porter comme `SettingsContext` global.

---

## État & données

### Mock data
- `SUPPLIERS` (data.jsx) : 6 fournisseurs avec id/name/short/color/rating/delivery
- `PRODUCTS` (data.jsx) : ~50 produits avec prix multi-fournisseurs
- `CATEGORIES` (data.jsx) : 8 catégories
- Chaque page JSX a ses propres datasets fictifs en constantes locales (OR_ORDERS, RX_DELIVERIES, TE_MEMBERS, SU_SUPPLIERS, etc.)

### Entités à modéliser côté prod

```ts
// Restaurant (tenant)
type Restaurant = {
  id: string;
  name: string;            // "Maison Lumière"
  address: string;
  type: "gastro" | "bistro" | "brasserie" | ...;
  vatNumber: string;
  createdAt: Date;
};

// User / Member
type Member = {
  id: string;
  restaurantId: string;
  firstName: string;
  lastName: string;
  email: string;
  tel: string;
  roleId: string;          // FK vers Role
  hiredAt: Date;
  status: "active" | "pending" | "suspended";
  lastActiveAt: Date;
  avatar?: string;
};

// Role (avec custom)
type Role = {
  id: string;
  restaurantId: string;
  name: string;
  color: string;           // hex
  permissions: Permission[]; // ["admin", "orders", "receive", ...]
  isCustom: boolean;
};

type Permission =
  | "admin" | "orders" | "receive" | "fiches"
  | "inventory" | "reports" | "treso" | "dashboard";

// Supplier
type Supplier = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  specialty: string;
  address: string;
  tel: string;
  email: string;
  contact: {
    name: string;
    role: string;
    tel: string;
    email: string;
  };
  deliveryDays: string[];
  deliveryHours: string;
  minOrder: number;
  francoPort: number;
  paymentTerms: string;
  rating: number;
};

// Order
type Order = {
  id: string;              // "CMD-2618"
  restaurantId: string;
  supplierId: string;
  authorId: string;        // Member qui a passé la commande
  createdAt: Date;
  expectedDeliveryAt: Date;
  lines: OrderLine[];
  subtotalHT: number;
  vat: number;
  totalTTC: number;
  status: OrderStatus;
  paymentStatus: "none" | "pending" | "paid";
  invoiceId?: string;
  cancelReason?: string;
  dispute?: string;
};

type OrderStatus =
  | "draft" | "sent" | "confirmed" | "preparing"
  | "shipped" | "delivered" | "received"
  | "dispute" | "cancelled";

type OrderLine = {
  productId: string;
  name: string;
  meta: string;
  qty: number;
  unit: string;
  unitPrice: number;
  receivedQty?: number;    // rempli au pointage
  status?: "ok" | "discrepancy" | "missing";
  note?: string;
};

// Reception (lié à Order)
type Reception = {
  orderId: string;
  receivedAt: Date;
  receivedByMemberId: string;
  driverName: string;
  temperatureC?: number;
  generalNote?: string;
  photos: string[];
  signatureDataUrl?: string;
  avoirAmount: number;      // calculé auto à partir des écarts
};

// Product (catalogue)
type Product = {
  id: string;
  name: string;
  category: Category;
  meta: string;            // "Noix · Cal. 20/30"
  unit: string;
  badge?: "best-price" | "new" | "promo";
  prices: ProductPrice[];  // 1 entrée par fournisseur
};

type ProductPrice = {
  supplierId: string;
  price: number;
  stock: "En stock" | "Stock faible" | "Sur commande" | "Rupture";
  pack: string;
  previousPrice?: number;
};

// Recipe (fiche technique)
type Recipe = {
  id: string;
  restaurantId: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  subRecipes?: Recipe[];
  sellPriceHT: number;
  vatRate: number;         // 5.5 | 10 | 20
  costHT: number;          // auto-calculé
  marginPct: number;       // auto-calculé
};
```

### State management suggéré
- **Server state** : TanStack Query (useQuery / useMutation) pour toutes les listes
- **UI state** : Zustand ou Jotai pour sidebar, tweaks, theme
- **Forms** : React Hook Form + Zod

---

## Accessibilité & responsive

### Accessibilité
- Tous les boutons icons doivent avoir un `aria-label`
- Les toggles (`.pr-toggle`) : utiliser un vrai `<input type="checkbox" role="switch">`
- Les modales doivent trapper le focus + `aria-modal="true"`
- Les tables : `role="table"` + `role="row"` sur les lignes cliquables avec `tabIndex={0}`
- Contrastes : tous les textes respectent WCAG AA (vérifié sur fond blanc et `--bg-subtle`)

### Responsive
- Breakpoints suggérés : `< 768px` → stack vertical, drawer plein écran, sidebar → drawer hamburger
- Les grilles d'écrans (`.pr-layout`, `.or-table-head`, etc.) doivent devenir 1 colonne sur mobile
- Mobile natif : voir `mobile.jsx` pour les patterns (tab bar bottom, hamburger, chips scrollables)

---

## Fichiers

### À lire en priorité
1. `src/styles.css` — **source de vérité absolue** pour les tokens, spacings, états
2. `src/shell.jsx` — structure de navigation (sidebar, topbar, items)
3. `src/data.jsx` — structures de données types
4. Pages prioritaires selon roadmap produit

### Ordre d'implémentation recommandé
1. **Fondations** : design tokens, typographie, composants de base (Button, Input, Card, Pill, Icon, Table)
2. **Shell** : sidebar + topbar + routing
3. **Dashboard** (vitrine, lu en premier par l'utilisateur)
4. **Catalogue + fiche technique** (coeur métier achats)
5. **À réceptionner + Mes commandes** (flux opérationnel)
6. **Mercuriale + Trésorerie + Factures**
7. **Fournisseurs + Équipe**
8. **Profil + Settings**
9. **Mobile + Onboarding**

---

## Assets

- **Icons** : toutes inline en SVG dans `src/icons.jsx`. Lucide-compatible — remplacer par `lucide-react` en prod (`import { ShoppingCart } from 'lucide-react'`).
- **Fonts** : Inter + JetBrains Mono via Google Fonts — à installer via `next/font` ou équivalent.
- **Illustrations** : aucune. Placeholders textuels uniquement.
- **Logos fournisseurs** : uniquement les initiales colorées dans des pastilles carrées ou rondes.

---

## Notes de style — à respecter absolument

- **Pas d'émojis** dans l'UI finale (hors copy marketing)
- **Pas de gradients agressifs** — sauf avatar profil (subtil indigo→violet)
- **Monospace sur TOUS les chiffres structurés** (prix, IDs, pourcentages, dates courtes, quantités)
- **Density-first** : préférer +1 ligne de données que +10px de padding
- **Uppercase labels de colonnes** : `font-size: 10.5px; font-weight: 650; letter-spacing: 0.04em`
- **Aucune ombre portée** sauf modales et dropdowns (boutons/cards = bordure 1px uniquement)
- **Hover = background change**, jamais transform/scale

---

## Questions ouvertes pour le dev

1. Stratégie i18n ? (mock actuel 100% FR)
2. Multi-tenant : restaurant unique ou groupe (chaîne/franchise) ?
3. Connexions externes prévues : banque (PSD2), caisse, comptabilité ?
4. Offline-first pour l'écran de réception (tablette cuisine) ?
5. Temps réel / WebSocket pour notifications ?
