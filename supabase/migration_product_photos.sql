-- ============================================================
-- RestoPilot — Photos produits
--
-- Ajoute :
--   - colonne produits.photos (text[]) : liste d'URLs, max 3
--   - bucket Storage "produits-photos" public en lecture
--   - policies RLS pour upload/update/delete scopées par user_id
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Colonne photos sur produits ──────────────────────────
alter table produits
  add column if not exists photos text[] default '{}'::text[];

-- ── 2. Bucket public ───────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('produits-photos', 'produits-photos', true)
on conflict (id) do update set public = true;

-- ── 3. Policies Storage (scope : <user_id>/<produit_id>/...) ──
drop policy if exists produits_photos_select_all  on storage.objects;
drop policy if exists produits_photos_upload_own  on storage.objects;
drop policy if exists produits_photos_update_own  on storage.objects;
drop policy if exists produits_photos_delete_own  on storage.objects;

create policy produits_photos_select_all on storage.objects for select
  using (bucket_id = 'produits-photos');

create policy produits_photos_upload_own on storage.objects for insert
  with check (
    bucket_id = 'produits-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy produits_photos_update_own on storage.objects for update
  using (
    bucket_id = 'produits-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy produits_photos_delete_own on storage.objects for delete
  using (
    bucket_id = 'produits-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 4. Diagnostic ──────────────────────────────────────────
select 'Colonne photos :' as info;
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'produits' and column_name = 'photos';

select 'Bucket :' as info;
select id, name, public from storage.buckets where id = 'produits-photos';

select 'Policies :' as info;
select policyname, cmd from pg_policies
 where tablename = 'objects' and policyname like 'produits_photos_%';
