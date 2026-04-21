-- ============================================================
-- RestoPilot — Comptes employés
--
-- 1. Extension role : 'employe'
-- 2. profiles.restaurant_id  : pour un employé, pointe vers le
--    restaurateur auquel il est rattaché (NULL pour les autres rôles)
-- 3. ca_journalier.saisi_par : qui a saisi (patron ou employé)
-- 4. RLS : employés accèdent à la saisie CA de leur restaurateur,
--    patron voit/gère ses employés.
--
-- À exécuter dans Supabase SQL Editor après migration_ca_journalier.sql.
-- ============================================================

-- ── 1. Extension du rôle ────────────────────────────────────
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('restaurateur','fournisseur','admin','employe'));

-- ── 2. Colonnes ─────────────────────────────────────────────
alter table profiles
  add column if not exists restaurant_id uuid references auth.users(id) on delete cascade;
create index if not exists profiles_restaurant_idx on profiles(restaurant_id);

alter table ca_journalier
  add column if not exists saisi_par uuid references auth.users(id) on delete set null;
create index if not exists ca_saisi_par_idx on ca_journalier(saisi_par);

-- ── 3. RLS profiles : patron ↔ employés ─────────────────────
-- Patron voit ses employés
drop policy if exists profiles_select_employes  on profiles;
create policy profiles_select_employes on profiles for select
  using (restaurant_id = auth.uid());

-- Patron met à jour ses employés
drop policy if exists profiles_update_employes  on profiles;
create policy profiles_update_employes on profiles for update
  using (restaurant_id = auth.uid()) with check (restaurant_id = auth.uid());

-- Patron supprime ses employés (utilisé par l'API serveur aussi)
drop policy if exists profiles_delete_employes  on profiles;
create policy profiles_delete_employes on profiles for delete
  using (restaurant_id = auth.uid());

-- Employé voit le profil de son patron (pour afficher nom du resto)
drop policy if exists profiles_employe_sees_patron on profiles;
create policy profiles_employe_sees_patron on profiles for select
  using (id = (select restaurant_id from profiles where id = auth.uid()));

-- ── 4. RLS ca_journalier : autorise l'employé ───────────────
-- On élargit l'accès pour inclure les employés dont le
-- restaurant_id correspond au restaurateur_id de la ligne.
drop policy if exists ca_own       on ca_journalier;
drop policy if exists ca_scope     on ca_journalier;
create policy ca_scope on ca_journalier for all
  using (
    restaurateur_id = auth.uid()
    or restaurateur_id = (select restaurant_id from profiles where id = auth.uid())
    or is_admin()
  )
  with check (
    restaurateur_id = auth.uid()
    or restaurateur_id = (select restaurant_id from profiles where id = auth.uid())
    or is_admin()
  );

-- ── 5. Diagnostic ──────────────────────────────────────────
select 'Rôles autorisés :' as info;
select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_role_check';

select 'Colonnes ajoutées :' as info;
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name='profiles' and column_name='restaurant_id')
     or (table_name='ca_journalier' and column_name='saisi_par'));

select 'Policies profiles :' as info;
select policyname, cmd from pg_policies where tablename = 'profiles' order by policyname;
