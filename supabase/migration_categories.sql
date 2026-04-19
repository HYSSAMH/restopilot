-- ============================================================
-- RestoPilot — Extension des catégories produits
-- Ajoute : herbes, pommes_de_terre, salades, cremerie
-- À exécuter après schema.sql
-- ============================================================

alter table produits drop constraint if exists produits_categorie_check;

alter table produits add constraint produits_categorie_check
  check (categorie in (
    'legumes',
    'fruits',
    'boucherie',
    'poissonnerie',
    'epicerie',
    'herbes',
    'pommes_de_terre',
    'salades',
    'cremerie'
  ));
