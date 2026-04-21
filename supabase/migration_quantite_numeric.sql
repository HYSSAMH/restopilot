-- ============================================================
-- RestoPilot — Fix : lignes_commande.quantite en numeric
--
-- Problème : la colonne était `integer` dans schema.sql → refuse les
-- quantités décimales (ex: 2.5 kg, 7.22 kg) utilisées lors de l'import
-- de factures. Erreur observée :
--   invalid input syntax for type integer: "7.22"
--
-- Correctif : bascule en `numeric` (supporte décimaux). La contrainte
-- `quantite > 0` est préservée.
--
-- À exécuter dans Supabase SQL Editor. Non destructif : conversion
-- sans perte pour toutes les valeurs existantes.
-- ============================================================

-- ── 1. Changement de type ───────────────────────────────────
alter table lignes_commande
  alter column quantite type numeric using quantite::numeric;

-- ── 2. Re-pose la check constraint (conservée par le alter type,
--    mais explicitée par sécurité) ─────────────────────────────
alter table lignes_commande drop constraint if exists lignes_commande_quantite_check;
alter table lignes_commande
  add  constraint lignes_commande_quantite_check check (quantite > 0);

-- ── 3. Diagnostic ───────────────────────────────────────────
select 'Type colonne quantite :' as info;
select column_name, data_type, numeric_precision
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'lignes_commande'
   and column_name  = 'quantite';

select 'Check constraint :' as info;
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.lignes_commande'::regclass
   and conname  = 'lignes_commande_quantite_check';

-- Vérifie qu'aucune ligne existante n'a quantite invalide
select 'Quantités décimales existantes :' as info;
select count(*) as nb_decimales
  from lignes_commande
 where quantite <> round(quantite);
