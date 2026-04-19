-- ============================================================
-- RestoPilot — Migration badges mercuriale
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- Colonnes badge sur la table tarifs
alter table tarifs
  add column if not exists badge             text        default null
    check (badge in ('nouveaute', 'prix_baisse')),
  add column if not exists badge_expires_at  timestamptz default null;

-- Index pour filtrer les badges actifs efficacement
create index if not exists tarifs_badge_expires_idx on tarifs (badge_expires_at)
  where badge is not null;
