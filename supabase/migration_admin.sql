-- ============================================================
-- RestoPilot — Espace admin
--
-- Ajoute :
--   - rôle 'admin' dans profiles (+ 2 colonnes : actif, notes_admin)
--   - fonction is_admin() basée sur la row profiles courante
--   - policies RLS "admin peut tout voir/modifier" (bypass complet)
--   - policies Storage idem sur logos + produits-photos
--
-- À exécuter dans Supabase SQL Editor.
--
-- Pour créer votre premier compte admin manuellement :
--   1. Inscrivez-vous normalement via /register (comme un restaurateur)
--   2. Dans SQL Editor :
--        update profiles
--           set role = 'admin'
--         where email = 'votre@email.com';
--        update auth.users
--           set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role','admin')
--         where email = 'votre@email.com';
--   3. Déconnectez-vous puis reconnectez-vous
-- ============================================================

-- ── 1. Extension du rôle + nouvelles colonnes ──────────────
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('restaurateur','fournisseur','admin'));

alter table profiles add column if not exists actif       boolean default true;
alter table profiles add column if not exists notes_admin text;

create index if not exists profiles_role_idx on profiles(role);

-- ── 2. Fonction is_admin() ────────────────────────────────
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from profiles
     where id = auth.uid()
       and role = 'admin'
  );
$$;

grant execute on function is_admin() to authenticated;

-- ── 3. Policies : admin peut tout voir/modifier ───────────
-- profiles
drop policy if exists profiles_select_admin on profiles;
drop policy if exists profiles_update_admin on profiles;
drop policy if exists profiles_insert_admin on profiles;
drop policy if exists profiles_delete_admin on profiles;
create policy profiles_select_admin on profiles for select using (is_admin());
create policy profiles_update_admin on profiles for update using (is_admin()) with check (is_admin());
create policy profiles_insert_admin on profiles for insert with check (is_admin());
create policy profiles_delete_admin on profiles for delete using (is_admin());

-- fournisseurs, produits, tarifs, commandes, lignes_commande
drop policy if exists fournisseurs_all_admin  on fournisseurs;
drop policy if exists produits_all_admin      on produits;
drop policy if exists tarifs_all_admin        on tarifs;
drop policy if exists commandes_all_admin     on commandes;
drop policy if exists lignes_all_admin        on lignes_commande;

create policy fournisseurs_all_admin on fournisseurs for all using (is_admin()) with check (is_admin());
create policy produits_all_admin     on produits     for all using (is_admin()) with check (is_admin());
create policy tarifs_all_admin       on tarifs       for all using (is_admin()) with check (is_admin());
create policy commandes_all_admin    on commandes    for all using (is_admin()) with check (is_admin());
create policy lignes_all_admin       on lignes_commande for all using (is_admin()) with check (is_admin());

-- Storage : admin peut upload/delete sur tous les buckets
drop policy if exists storage_all_admin on storage.objects;
create policy storage_all_admin on storage.objects for all
  using (bucket_id in ('logos','produits-photos') and is_admin())
  with check (bucket_id in ('logos','produits-photos') and is_admin());

-- ── 4. Diagnostic ──────────────────────────────────────────
select 'Rôle admin + colonnes ajoutées :' as info;
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('role','actif','notes_admin')
 order by column_name;

select 'Fonction is_admin() :' as info;
select proname from pg_proc where proname = 'is_admin';

select 'Policies admin :' as info;
select tablename, policyname, cmd
  from pg_policies
 where policyname like '%_admin'
 order by tablename, policyname;
