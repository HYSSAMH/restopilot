-- ============================================================
-- RestoPilot — Catégories sur lignes_commande et commandes
--
-- Permet de classifier chaque produit (ex: "alimentaire/boucherie",
-- "energie/gaz") et de calculer une catégorie dominante au niveau
-- de la commande pour les rapports.
-- ============================================================

-- ── 1. Colonne categorie sur lignes_commande ──────────────────
alter table lignes_commande
  add column if not exists categorie text;

comment on column lignes_commande.categorie is
  'Catégorie hiérarchique du produit (ex: "alimentaire/boucherie", "energie/gaz"). Voir lib/categories.ts pour la taxonomie.';

create index if not exists lignes_commande_categorie_idx
  on lignes_commande(categorie);

-- ── 2. Colonne categorie_dominante sur commandes ──────────────
alter table commandes
  add column if not exists categorie_dominante text;

comment on column commandes.categorie_dominante is
  'Catégorie dominante de la facture, calculée si une catégorie représente ≥70% du HT, sinon "mixte".';

create index if not exists commandes_categorie_idx
  on commandes(categorie_dominante);

-- ── 3. Diagnostic ────────────────────────────────────────────
select 'Colonnes catégories ajoutées :' as info;
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'lignes_commande' and column_name = 'categorie')
     or (table_name = 'commandes' and column_name = 'categorie_dominante'));
