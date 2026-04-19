-- ============================================================
-- RestoPilot — Workflow avoirs (accept / contest / resolve)
--
-- Ajoute à commandes :
--   - avoir_statut       : null | en_attente | accepte | conteste | annule
--   - avoir_motif_contestation (si statut = 'conteste')
--   - avoir_accepte_at, avoir_conteste_at, avoir_annule_at
--   - avoir_arbitre_admin (bool, résolu par admin)
--
-- À exécuter après migration_receptions.sql.
-- ============================================================

alter table commandes
  add column if not exists avoir_statut text default null
  check (avoir_statut is null or avoir_statut in ('en_attente','accepte','conteste','annule'));

alter table commandes
  add column if not exists avoir_motif_contestation text default null;

alter table commandes
  add column if not exists avoir_accepte_at   timestamptz default null;

alter table commandes
  add column if not exists avoir_conteste_at  timestamptz default null;

alter table commandes
  add column if not exists avoir_annule_at    timestamptz default null;

alter table commandes
  add column if not exists avoir_arbitre_admin boolean default false;

create index if not exists commandes_avoir_statut_idx on commandes(avoir_statut);

-- Diagnostic
select 'Colonnes avoir :' as info;
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'commandes'
   and column_name like 'avoir%';
