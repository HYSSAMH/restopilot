# CHANGELOG — RestoPilot Design v2

> Handoff from **Claude Design** → **Claude Code**.
> Design created in HTML/React (Babel standalone) as reference — to be reimplemented in Next.js 16 App Router + Tailwind + Supabase.

## Context

v2 is a **full visual + structural redesign** of the RestoPilot SaaS (restaurant purchasing + cost management). The prototype in `src/` covers **22 pages** across 4 personas : restaurateur (gastro), employé salle, fournisseur distributeur, admin plateforme.

## Positioning

Benchmarks visuels : **Linear · Notion · Pennylane · Stripe Dashboard**. Philosophie SaaS B2B pro — densité élevée, typographie mono pour les chiffres, accent indigo unique, pas de décorations gratuites.

## Stack cible (à respecter)

- Next.js 16 App Router (SSR)
- TailwindCSS (preset fourni : `tokens/tailwind.config.ts`)
- Supabase
- SVG inline dans `components/ui/Icon.tsx`
- Pas de framework UI lourd (no shadcn/ui by default — reprendre nos specs)
- Font stack : Inter (corps) + JetBrains Mono (chiffres) + Playfair Display (cartes imprimées uniquement)

## Changements vs v1

### Visuel
- **Accent unique indigo `#6366F1`** (remplace ancien bleu). Utilisé parcimonieusement — primary CTA, active nav, focus rings, sélections.
- **Mono tabulaire systématique** sur tous les chiffres (KPIs, prix, quantités, dates ISO) → `font-variant-numeric: tabular-nums` + JetBrains Mono.
- **Neutres légèrement chauds** (`#FAFAFA` bg, `#0F172A` text) — moins cliniques que slate pur.
- **Radii réduits** : `8–10px` sur cards/inputs, `12–14px` sur modals/drawers. Plus jamais 16+ sauf hero.
- **Shadows discrètes** : `elev-2` par défaut sur cards, `elev-3` sur hover/float, `elev-5` sur modals.
- **Borders toujours `1px solid var(--border)`** — jamais dashed sauf drop-zones.

### Layout & navigation
- **Sidebar 240px** avec sections nommées (Principal / Gestion / Menu / Fournisseurs / Équipe / Compte).
- **Topbar 56px** avec breadcrumbs + recherche globale + cloche + avatar.
- **Mobile shell dédié** (page `mobile` dans `mobile.jsx`) — bottom tab bar + drawer. PAS de sidebar responsive, vraie navigation native.
- **Breadcrumbs obligatoires** sur toutes les pages principales.
- **Page-enter animation** (`fadeIn 200ms` avec `fill-mode: both`) sur chaque route.

### Densité
- Tables : row height 44–48px (pas 56+), padding horizontal 16px, gap colonnes 14px.
- Typo body : 13px (md: 14px) — pas 16px web classique.
- Labels uppercase `11px / 0.04em tracking / fw-600 / text-muted`.
- KPIs : 22–28px mono strong, tracking -0.02em.

### Composants-clés ajoutés
- **Drawer latéral** 520–560px pour les détails (commandes, fournisseurs, réceptions) — slide-in depuis la droite, backdrop flou.
- **Modal plein écran** (1320×900) pour Budget Editor — split view avec sliders + preview live.
- **Timeline horizontale** cycle de vie commande.
- **Sparklines inline** dans KPI cards (SVG minuscule, 60×20).
- **Ponctualité bar** (fill coloré selon seuil) pour fournisseurs.
- **Dropzone import IA** avec animation 5 étapes (OCR → rapprochement → détection → validation → prêt).
- **Permission chips** (admin / custom / regular) pour les rôles équipe.
- **Tabs pill** (background bg-subtle, item actif blanc avec elev-1).

### Pages ajoutées en v2
- Dashboard restaurateur (KPIs + alertes + graphique CA)
- Catalogue commande multi-fournisseurs (comparateur prix)
- Fiche technique (calcul coût de revient, sous-recettes)
- Mercuriale fournisseur (import PDF IA, badges prix)
- Trésorerie (pointage bancaire, factures, masse salariale)
- Mobile shell (vue restaurateur smartphone)
- Saisie CA employé (plein écran, sans sidebar)
- Espace fournisseur distributeur
- Admin plateforme (utilisateurs, établissements)
- Rapport de marge détaillé
- Mercuriale import (dropzone + animation IA)
- Réception livraison (pointage BL, écarts, avoirs)
- Planning équipe
- Inventaire mensuel
- Analytics multi-sites
- Composer la carte (builder menu avec Playfair preview)
- Factures & avoirs fournisseurs (import IA + split view Pennylane-style)
- Historique des achats (barres mensuelles, panier moyen, timeline)
- Analyse des prix (heatmap évolution, alertes anomalies)
- Budget (enveloppes par catégorie + simulation marge)
- Budget Editor (modal plein écran, sliders, presets, breakdown mensuel)
- À réceptionner (liste groupée par jour + détail réception)
- Mes commandes (liste dense filtrable + drawer timeline)
- Fournisseurs externes (annuaire + drawer stats 12 mois)
- Équipe (annuaire + rôles custom + activité)
- Mon profil (identité / sécurité / préférences / notifications)

### Écrans NON livrés en v2 (à créer côté dev ou lors d'une v2.1 design)
- Login / Register / Reset password
- Onboarding premier login
- Dashboard Fournisseur (distributeur côté pro)
- Admin multi-sites avec pricing/billing Stripe
- États erreur 404 / 500 / offline
- Empty states dédiés pour chaque table vide

Ces écrans peuvent être dérivés des tokens + composants fournis sans relancer un cycle design.

### Décisions UX majeures
1. **Import PDF/photo avec animation IA** — déclenche OCR + rapprochement + détection prix + validation. UX du handoff humain sur écarts.
2. **Split view partout où il y a liste + détail** — pas de nav vers une page détail, drawer ou panel latéral pour garder le contexte.
3. **Cycle de vie commande explicite** — timeline horizontale avec étapes done/current/pending, pas juste un statut pill.
4. **Comparateur prix catalogue** — vue tableau avec tous les fournisseurs côte à côte, best price highlighté.
5. **Mobile ≠ desktop rétréci** — vraie shell mobile avec bottom tabs, pas responsive CSS.
6. **Rôles custom** — n'importe qui peut créer un rôle sur-mesure (pas juste les préfabriqués).

### Contraintes respectées
- SSR-compat : aucun composant du proto ne dépend de `window` au render (sauf `window.claude.complete` qui est volontaire). Le CSS est pur, pas de CSS-in-JS.
- Aucune fonctionnalité existante supprimée : toutes les routes/tables/imports/TVA/sous-recettes/conditionnements supposées conservées côté back.
- Icônes Lucide inline (pas de package à charger côté runtime).

### Questions ouvertes — réponses
- **Mode sombre** : preview tokens fourni (`[data-theme="dark"]` dans `tokens.css`), non prioritaire v2, tous les composants utilisent les var CSS donc migration faisable sans toucher au markup.
- **Accessibilité** : contraste AA sur tous les text/bg (testé sur text-muted `#64748B` sur `#FFFFFF` = 5.36:1 AA-large, à remplacer par `#475569` 7.64:1 pour AAA si besoin). Focus visible fourni (`--ring`). Navigation clavier prévue via attribut `tabindex` + roles ARIA à ajouter côté code.
- **Mode compact** : la densité actuelle EST déjà compact. Pas de mode 2x plus dense prévu — risquerait de casser la hiérarchie.
