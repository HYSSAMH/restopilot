# RestoPilot — Design Handoff v2

> De **Claude Design** → **Claude Code**
> Dossier de référence complet pour réimplémenter l'app dans un Next.js 16 + Tailwind + Supabase.

## 📦 Contenu

```
design_handoff_v2/
├── README.md                   ← tu es ici
├── CHANGELOG.md                ← ce qui a changé vs v1 + décisions UX
├── tokens/
│   ├── tokens.css              ← variables CSS (source of truth)
│   ├── tokens.json             ← format Design Tokens W3C
│   └── tailwind.config.ts      ← preset Tailwind à importer
├── components/SPECS.md         ← 25 composants avec tous les états
├── screens/SPECS.md            ← chaque page + mapping fichier JSX + arborescence /app
├── charts/SPECS.md             ← specs Recharts (couleurs, grilles, animations)
├── icons/ICONS.md              ← liste Lucide utilisée + contrat composant
├── animations/MOTION.md        ← easings, durées, micro-interactions
├── accessibility/A11Y.md       ← contrastes, ARIA, clavier, reduced-motion
└── src/                        ← 24 fichiers de référence (HTML + JSX + CSS)
    ├── index.html              ← entry du prototype (React + Babel standalone)
    ├── styles.css              ← CSS vanilla — à traduire en classes Tailwind
    ├── app.jsx                 ← router + state global
    ├── shell.jsx               ← sidebar + topbar + routing
    ├── icons.jsx               ← toutes les icônes inline
    ├── data.jsx                ← mock data (à remplacer par queries Supabase)
    └── {dashboard, catalogue, fiche, mercuriale, treso, mobile,
          extras, ops, more, invoices, analytics-deep, budget-editor,
          receive, orders, suppliers, team, profile, tweaks-panel}.jsx
```

## 🚀 Quick start Claude Code

1. **Lire dans l'ordre** : `CHANGELOG.md` → `README.md` → `tokens/` → `components/SPECS.md` → `screens/SPECS.md`.
2. **Copier `tokens.css`** dans `app/globals.css` (ou `@import` si tu préfères).
3. **Importer le preset Tailwind** :
   ```ts
   // tailwind.config.ts
   import preset from './design_handoff_v2/tokens/tailwind.config';
   export default { presets: [preset], content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'] };
   ```
4. **Construire les primitives** (`components/ui/*`) depuis `components/SPECS.md`.
5. **Construire les features** (`components/features/*`) en suivant l'arborescence dans `screens/SPECS.md`.
6. **Ouvrir le prototype** dans un navigateur : `src/index.html` — référence visuelle live.
7. **Matcher écran par écran** dans l'ordre d'impact : Dashboard → Catalogue → Commandes → Réceptions → Factures → Fiches → Budget.

## ⚙ Stack cible (non négociable)
- Next.js 16 App Router (SSR-compat obligatoire)
- TailwindCSS (preset fourni)
- Supabase
- SVG inline dans `components/ui/Icon.tsx`
- Aucun framework UI lourd
- Font stack : Inter + JetBrains Mono + Playfair Display (cartes imprimées uniquement)

## 🎯 Fidélité
**High-fidelity** — pixel-perfect attendu. Tous les tokens sont fixés ; respecter :
- radii (8–10px cards, 12–14px modals)
- line-heights exactes (voir `tokens.css`)
- mono tabulaire sur tous les chiffres
- focus ring systématique
- animations (easing + durée dans `animations/MOTION.md`)

## ❗ Points d'attention
- **SSR-compat** : aucun accès `window` au render (le proto utilise Babel standalone côté client uniquement). Tous les composants markup sont purs — migration directe vers RSC/Client Components.
- **Mobile** : shell dédié (`src/mobile.jsx`), PAS du responsive CSS classique sur le desktop shell.
- **Import IA** : UX avec 5 steps animées à préserver (cœur de la promesse produit).
- **Rôles custom** : l'utilisateur peut créer des rôles sur-mesure, pas juste les préfabriqués.
- **Split view** partout où liste + détail — drawer à droite, pas de navigation vers page détail.

## 🧩 Écrans couverts v2 (22)
Dashboard · Catalogue commande · Fiche technique · Mes commandes · À réceptionner · Factures · Trésorerie · Mercuriale · Fournisseurs · Équipe · Profil · Budget · Budget Editor · Historique achats · Analyse prix · Rapport marge · Composer la carte · Inventaire · Planning · Mobile shell · Saisie CA employé · Espace fournisseur · Admin plateforme.

## ⏳ Écrans à dériver côté dev
Login / Register / Reset password · Onboarding · Dashboard Fournisseur pro · Admin multi-sites Stripe · 404 / 500 / offline · empty states dédiés.
→ Les tokens et composants fournis suffisent pour les construire sans relancer un cycle design.

## 📬 Feedback loop
Si un composant ou écran manque / est ambigu, me pinger directement via Hyssam. Les JSX de référence sont la source de vérité ultime pour toute question de layout/copy/comportement.
