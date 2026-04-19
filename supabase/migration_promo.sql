-- Add 'promotion' to badge check constraint and ancien_prix column

-- Drop existing check constraint on badge
alter table tarifs drop constraint if exists tarifs_badge_check;

-- Re-add with promotion included
alter table tarifs
  add constraint tarifs_badge_check
  check (badge in ('nouveaute', 'prix_baisse', 'promotion'));

-- Add ancien_prix column
alter table tarifs
  add column if not exists ancien_prix numeric default null;
