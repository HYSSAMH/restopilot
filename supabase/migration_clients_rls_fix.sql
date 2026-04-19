-- ============================================================
-- RestoPilot — Fix RLS : un fournisseur peut lire le profil
-- d'un restaurateur qui a au moins une commande chez lui.
--
-- Sans cette policy, la fiche /dashboard/fournisseur/clients/[id]
-- affiche "Client introuvable" alors même que la commande existe.
--
-- À exécuter dans Supabase SQL Editor après migration_clients.sql.
-- ============================================================

drop policy if exists profiles_select_clients on profiles;
create policy profiles_select_clients on profiles for select
  using (
    role = 'restaurateur'
    and exists (
      select 1
        from commandes c
       where c.restaurateur_id = profiles.id
         and c.fournisseur_id  = auth.uid()
    )
  );

-- Diagnostic
select 'Policies profiles après fix :' as info;
select policyname, cmd, qual
  from pg_policies
 where tablename = 'profiles'
 order by policyname;

-- Test manuel (optionnel, remplace <FOURN_UUID> par votre id) :
--   set local role authenticated;
--   set local "request.jwt.claims" = '{"sub":"<FOURN_UUID>"}';
--   select count(*) from profiles where role = 'restaurateur';
-- Doit retourner le nombre de restaurateurs ayant commandé chez vous.
