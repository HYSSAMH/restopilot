-- ============================================================
-- RestoPilot — Import de factures + fournisseurs externes
--
-- Tables :
--   - fournisseurs_externes : fiches fournisseurs non-inscrits,
--     scopées à un restaurateur (détectées depuis factures importées)
--
-- Commandes : extension pour tracer l'origine
--   - source                   : 'app' | 'import'
--   - fournisseur_externe_id   : lien vers fournisseurs_externes
--   - numero_facture_externe   : N° de facture du fournisseur
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Table fournisseurs externes ─────────────────────────
create table if not exists fournisseurs_externes (
  id              uuid primary key default gen_random_uuid(),
  restaurateur_id uuid not null references auth.users(id) on delete cascade,
  nom             text not null,
  email           text,
  telephone       text,
  adresse         text,
  siret           text,
  invite_envoyee  timestamptz default null,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists fe_resto_idx on fournisseurs_externes(restaurateur_id);

alter table fournisseurs_externes enable row level security;

drop policy if exists fe_all_own on fournisseurs_externes;
create policy fe_all_own on fournisseurs_externes for all
  using (restaurateur_id = auth.uid() or is_admin())
  with check (restaurateur_id = auth.uid() or is_admin());

drop trigger if exists fe_updated_at on fournisseurs_externes;
create trigger fe_updated_at before update on fournisseurs_externes
  for each row execute function set_updated_at();

-- ── 2. Extension commandes ──────────────────────────────────
alter table commandes
  add column if not exists source text default 'app'
  check (source in ('app','import'));

alter table commandes
  add column if not exists fournisseur_externe_id uuid
  references fournisseurs_externes(id) on delete set null;

alter table commandes
  add column if not exists numero_facture_externe text default null;

create index if not exists commandes_fe_idx     on commandes(fournisseur_externe_id);
create index if not exists commandes_source_idx on commandes(source);

-- ── 3. Diagnostic ───────────────────────────────────────────
select 'fournisseurs_externes OK' as check1,
       (select count(*) from fournisseurs_externes) as nb;

select 'Colonnes ajoutées commandes :' as info;
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'commandes'
   and column_name in ('source','fournisseur_externe_id','numero_facture_externe');
