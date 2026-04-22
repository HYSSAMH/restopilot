-- ============================================================
-- RestoPilot — Nettoyage des données fictives
-- À exécuter dans l'éditeur SQL Supabase
-- Supprime toutes les données de démo, conserve ProFrais Distribution
-- ============================================================

-- 1. Lignes de commande (dépendent des commandes)
delete from lignes_commande;

-- 2. Commandes
delete from commandes;

-- 3. Tarifs (dépendent des produits et des fournisseurs)
delete from tarifs;

-- 4. Produits (tous — les vrais seront ajoutés via la mercuriale)
delete from produits;

-- 5. Fournisseurs fictifs — on conserve uniquement ProFrais Distribution
delete from fournisseurs
where id != 'f1000000-0000-0000-0000-000000000001';

-- Vérification : affiche ce qui reste
select 'fournisseurs' as table_name, count(*)::text as remaining from fournisseurs
union all
select 'produits',       count(*)::text from produits
union all
select 'tarifs',         count(*)::text from tarifs
union all
select 'commandes',      count(*)::text from commandes
union all
select 'lignes_commande',count(*)::text from lignes_commande;
