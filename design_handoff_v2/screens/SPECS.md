# Écrans — specs et mapping

> Chaque écran a son fichier JSX de référence dans `../src/`.
> Les descriptions ci-dessous donnent layout, composants, copies, comportements — Claude Code les reproduit dans `/app/(pages)/...` et `/components/features/...`.

## Structure arborescence proposée

```
app/
├── layout.tsx                    → shell.jsx
├── (app)/
│   ├── layout.tsx                → sidebar + topbar
│   ├── dashboard/page.tsx        → dashboard.jsx
│   ├── commandes/
│   │   ├── nouvelle/page.tsx     → catalogue.jsx
│   │   ├── page.tsx              → orders.jsx
│   │   └── [id]/page.tsx         → detail via drawer
│   ├── receptions/
│   │   ├── page.tsx              → receive.jsx (liste)
│   │   └── [id]/page.tsx         → receive.jsx (detail)
│   ├── factures/page.tsx         → invoices.jsx
│   ├── mercuriale/page.tsx       → mercuriale.jsx
│   ├── fournisseurs/page.tsx     → suppliers.jsx
│   ├── analytique/
│   │   ├── achats/page.tsx       → analytics-deep.jsx (PurchaseHistoryPage)
│   │   ├── prix/page.tsx         → analytics-deep.jsx (PriceAnalysisPage)
│   │   ├── budget/page.tsx       → analytics-deep.jsx (BudgetPage) + budget-editor.jsx
│   │   ├── marge/page.tsx        → more.jsx (rapport marge)
│   │   └── tresorerie/page.tsx   → treso.jsx
│   ├── menu/
│   │   ├── fiches/page.tsx       → fiche.jsx
│   │   └── composition/page.tsx  → more.jsx (composer la carte)
│   ├── equipe/page.tsx           → team.jsx
│   └── profil/page.tsx           → profile.jsx
├── mobile/page.tsx               → mobile.jsx
├── employe/page.tsx              → extras.jsx (EmployeeShift)
├── fournisseur/page.tsx          → extras.jsx (SupplierDashboard)
└── admin/page.tsx                → extras.jsx (AdminConsole)

components/
├── ui/ (Button, Input, Card, etc. à créer depuis components/SPECS.md)
├── features/
│   ├── sidebar/
│   ├── topbar/
│   ├── kpi-card/
│   ├── import-dropzone/
│   ├── supplier-drawer/
│   ├── order-drawer/
│   └── …
└── icons/Icon.tsx                → icons.jsx
```

---

## Page 1 — Dashboard
**Référence** : `src/dashboard.jsx`
**Route** : `/dashboard`
**Purpose** : vue d'ensemble resto — KPIs du jour, alertes, CA semaine.

**Layout desktop** : content max-width 1440px, padding 24px.
- Header page : h1 "Dashboard" 22px strong -0.01em tracking, sub 13px muted.
- Row 1 : 4 KPI cards (grid 1fr × 4, gap 12px) — CA jour, coût matière %, marge %, couverts.
- Row 2 : Line chart CA 7 jours (2/3 width) + panneau alertes (1/3 width).
- Row 3 : Derniers commandes (table) + Top 5 plats (liste).

**KPI card** : label uppercase, value 28px mono strong, delta pill vert/rouge, sparkline SVG 60×20 inline.
**Alertes** : chaque alerte = icon 16 + texte 13px + CTA ghost. Types : `low-stock`, `price-spike`, `delivery-delay`, `margin-drop`.

---

## Page 2 — Catalogue commande
**Référence** : `src/catalogue.jsx`
**Route** : `/commandes/nouvelle`
**Purpose** : comparateur prix multi-fournisseurs, ajout panier.

**Layout** : split 70/30 — catalogue gauche, panier droite (sticky).
- Filtres haut : recherche + catégorie + fournisseur + tri.
- Table : produit / conditionnement / **prix halles / prix marée / prix terroir** (3 colonnes fournisseurs), best price highlighté accent-soft + ★.
- Panier droite : liste lignes + totaux HT/TVA/TTC + CTA primary "Valider commande".

---

## Page 3 — Fiche technique
**Référence** : `src/fiche.jsx`
**Route** : `/menu/fiches/[id]`
**Purpose** : recette + calcul coût de revient + marge théorique.

**Layout** : header plat + 2 colonnes (ingrédients / métriques).
- Hero plat : photo 280×200, titre 28px tracking -0.02em, category pill.
- Ingrédients : table éditable (produit, qté, unité, coût unit, **coût total mono**).
- Sous-recettes : ligne avec icon `layers`, quantité, lien vers sous-fiche.
- Métriques : coût portion, prix carte, marge €, **marge %** (bar colorée selon seuil), couverture.

---

## Page 4 — Mes commandes
**Référence** : `src/orders.jsx`
**Route** : `/commandes`
**Purpose** : historique filtrable avec détail drawer.

Filtres : search, période, fournisseur, statut, montant range, toggle "Litiges".
Table 8 colonnes : checkbox, date, n° (mono), fournisseur (badge+nom+spec), lignes, TTC, statut pill, chevron.
Drawer 560px au clic : head fournisseur+statut · bannière si litige · 4 méta cards · aperçu lignes · totaux · **timeline horizontale** · 3 actions (PDF, facture, litige).

---

## Page 5 — À réceptionner
**Référence** : `src/receive.jsx`
**Route** : `/receptions`
**Purpose** : calendrier livraisons à venir + pointage.

Layout :
- Row 4 stats : aujourd'hui, semaine, en transit, écarts mois.
- Liste groupée par jour (Aujourd'hui / Demain / Jeudi).
- Card livraison : fournisseur badge + nom, ETA mono, lignes attendues, montant prévu, CTA "Pointer".

Detail receive (clic card) :
- Header BL-24891 + fournisseur + montant + avoir à demander (calculé live).
- Table lignes : produit / attendu / reçu (input) / écart / statut OK/écart/refus.
- Calcul avoir en temps réel.
- CTA "Signer et clôturer".

---

## Page 6 — Factures
**Référence** : `src/invoices.jsx`
**Route** : `/factures`
**Purpose** : factures fournisseurs reçues + avoirs + import IA.

Layout split view style Pennylane :
- Haut : dropzone import IA 5 étapes.
- Gauche 40% : liste factures (n°, fournisseur, date, TTC, statut).
- Droite 60% : preview PDF simulé + métadonnées extraites + rapprochement mercuriale (écarts highlightés).

---

## Page 7 — Trésorerie
**Référence** : `src/treso.jsx`
**Route** : `/analytique/tresorerie`
**Purpose** : pointage bancaire, factures, masse salariale.

Row KPI : solde, prévisions 30j, en attente paiement, charges fixes.
Tableau transactions avec colonne "rapproché" (checkbox).
Graphique masse salariale sur 6 mois.

---

## Page 8 — Mercuriale fournisseur
**Référence** : `src/mercuriale.jsx`
**Route** : `/mercuriale`
**Purpose** : import PDF/photo IA + visualisation tarifs.

Dropzone hero + animation 5 steps + tableau produits (nom, conditionnement, prix avec trend up/down vs mois dernier).

---

## Page 9 — Fournisseurs externes
**Référence** : `src/suppliers.jsx`
**Route** : `/fournisseurs`
**Purpose** : annuaire + perf + drawer détail.

Table 8 cols : fournisseur, commandes, CA total, panier moyen, ponctualité (bar colorée), dernière cmd, contact, chevron.
Drawer 560px : 3 KPI, bar chart CA 12 mois couleurs fournisseur, coordonnées, carte commercial attitré, dernières cmd.

---

## Page 10 — Équipe
**Référence** : `src/team.jsx`
**Route** : `/equipe`
**Purpose** : annuaire + rôles + activité.

3 onglets pill : Membres, Rôles & permissions, Activité.
- Membres : grid cards 280px min, avatar coloré, rôle pill, contact, "Depuis {date}".
- Rôles : grid role cards + "Nouveau poste" dashed → modal création avec permissions cochables.
- Activité : flux vertical "{qui} {action} {cible} · {when}".

---

## Page 11 — Mon profil
**Référence** : `src/profile.jsx`
**Route** : `/profil`
**Purpose** : compte user.

Layout 240 left nav + panel.
4 onglets : Identité / Sécurité / Préférences / Notifications.
- Identité : avatar lg + form 2 cols.
- Sécurité : password · 2FA toggle · sessions actives (3 devices avec icônes `monitor`/`smartphone`, current highlighté).
- Préférences : langue, fuseau, **sélecteur thème visuel** (3 mini-previews light/dark/auto), formats.
- Notifications : matrice événement × canaux (email/push) avec toggles.

---

## Pages Budget / Historique / Prix
**Référence** : `src/analytics-deep.jsx`
**Route** : `/analytique/{budget|achats|prix}`

### Historique des achats
Bar chart mensuel 6 mois, 3 KPIs (panier moyen, nb commandes, couverture jours), répartition fournisseurs, timeline filtrable.

### Analyse des prix
Heatmap évolution prix (12 mois × top 20 produits), alertes anomalies (hausse >5%), top hausses / baisses.

### Budget
6 enveloppes par catégorie (Matières, Boissons, Salaires, Loyer, Marketing, Maintenance) avec barres usage + restant + alerte si >80%.
Bouton "Ajuster les budgets" → modal Budget Editor.

### Budget Editor
**Référence** : `src/budget-editor.jsx`
**Modal 1320×900**.
Split gauche (enveloppes éditables + presets : 'Défensif', 'Normal', 'Croissance') / droite (preview live marge théorique + breakdown mensuel expandable).
Sliders avec value mono inline + % du CA total.

---

## Pages Mobile + Employé + Fournisseur + Admin
Déjà auto-contenues dans `mobile.jsx` et `extras.jsx`. Voir ces fichiers pour la shell complète.
