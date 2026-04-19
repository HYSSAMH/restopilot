-- ============================================================
-- RestoPilot — Accès lecture profils fournisseurs (factures)
--
-- Un restaurateur authentifié doit pouvoir lire les infos
-- facturation d'un fournisseur (raison_sociale, SIRET, adresse,
-- IBAN, horaires…) pour générer une facture conforme.
--
-- On autorise la lecture des profils dont role='fournisseur'
-- pour n'importe quel user authentifié. Les profils des
-- restaurateurs restent privés (profiles_select_self).
--
-- À exécuter après migration_profile.sql.
-- ============================================================

drop policy if exists profiles_select_fournisseurs on profiles;
create policy profiles_select_fournisseurs on profiles for select
  using (role = 'fournisseur' and auth.uid() is not null);

-- Diagnostic
select tablename, policyname, cmd
  from pg_policies
 where tablename = 'profiles'
 order by policyname;
