-- ============================================================
-- RestoPilot — Colonnes profil détaillé + bucket logos
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Colonnes communes aux deux rôles ─────────────────────
alter table profiles add column if not exists nom_commercial  text;
alter table profiles add column if not exists raison_sociale  text;
alter table profiles add column if not exists siret           text check (siret is null or siret ~ '^[0-9]{14}$');
alter table profiles add column if not exists adresse_ligne1  text;
alter table profiles add column if not exists adresse_ligne2  text;
alter table profiles add column if not exists code_postal     text;
alter table profiles add column if not exists ville           text;
alter table profiles add column if not exists telephone       text;
alter table profiles add column if not exists email_contact   text;
alter table profiles add column if not exists logo_url        text;

-- ── 2. Colonnes restaurateur ────────────────────────────────
alter table profiles add column if not exists adresse_livraison_ligne1 text;
alter table profiles add column if not exists adresse_livraison_ligne2 text;
alter table profiles add column if not exists adresse_livraison_cp     text;
alter table profiles add column if not exists adresse_livraison_ville  text;
alter table profiles add column if not exists type_restaurant          text;
alter table profiles add column if not exists nombre_couverts          integer check (nombre_couverts is null or nombre_couverts >= 0);

-- ── 3. Colonnes fournisseur ─────────────────────────────────
alter table profiles add column if not exists adresse_facturation_ligne1 text;
alter table profiles add column if not exists adresse_facturation_ligne2 text;
alter table profiles add column if not exists adresse_facturation_cp     text;
alter table profiles add column if not exists adresse_facturation_ville  text;
alter table profiles add column if not exists iban                       text;
alter table profiles add column if not exists bic                        text;
alter table profiles add column if not exists zone_livraison             text;
alter table profiles add column if not exists montant_minimum_commande   numeric default 0;
alter table profiles add column if not exists jours_livraison            text[];
alter table profiles add column if not exists horaires_livraison         text;

-- ── 4. Bucket Storage "logos" + policies ────────────────────
-- Chaque user upload dans <user_id>/logo.<ext>
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

drop policy if exists logos_select_all  on storage.objects;
drop policy if exists logos_upload_own  on storage.objects;
drop policy if exists logos_update_own  on storage.objects;
drop policy if exists logos_delete_own  on storage.objects;

create policy logos_select_all on storage.objects for select
  using (bucket_id = 'logos');

create policy logos_upload_own on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy logos_update_own on storage.objects for update
  using (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy logos_delete_own on storage.objects for delete
  using (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 5. Diagnostic ───────────────────────────────────────────
select 'Colonnes profiles ajoutées :' as info;
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'profiles'
 order by ordinal_position;

select 'Bucket logos :' as info;
select id, name, public from storage.buckets where id = 'logos';

select 'Policies logos :' as info;
select policyname, cmd from pg_policies
 where tablename = 'objects' and policyname like 'logos_%';
