-- ============================================================
-- RestoPilot — TVA, ventes et variation prix (module menu)
--
-- Ajoute :
--   • tarifs.tva_taux             : TVA applicable au prix fournisseur (20 % par défaut — achat pro)
--   • tarifs.prix_precedent       : dernier prix avant modif (pour indicateurs de variation)
--   • tarifs.prix_precedent_maj   : date de cette dernière modif
--   • menu_plats.ventes_par_semaine : volume de ventes hebdo (saisi manuellement)
--
-- Trigger : à chaque UPDATE de tarifs.prix, on archive l'ancien prix
-- dans prix_precedent (pour afficher ↗ / ↘ côté mercuriale).
--
-- Dépendances : migration_menu.sql, schema.sql (tarifs).
-- ============================================================

-- ── 1. Colonnes tarifs ─────────────────────────────────────────────
alter table tarifs
  add column if not exists tva_taux numeric(5,2) default 20
    check (tva_taux in (5.50, 10, 20)),
  add column if not exists prix_precedent     numeric(12,2),
  add column if not exists prix_precedent_maj timestamptz;

-- ── 2. Colonne menu_plats.ventes_par_semaine ──────────────────────
alter table menu_plats
  add column if not exists ventes_par_semaine numeric(12,2) default 0
    check (ventes_par_semaine >= 0);

-- ── 3. Trigger : archive ancien prix sur tarifs ────────────────────
create or replace function tarifs_archive_prix()
returns trigger
language plpgsql
as $$
begin
  if new.prix is distinct from old.prix then
    new.prix_precedent     = old.prix;
    new.prix_precedent_maj = now();
  end if;
  return new;
end;
$$;

drop trigger if exists tarifs_archive_prix on tarifs;
create trigger tarifs_archive_prix
  before update of prix on tarifs
  for each row execute function tarifs_archive_prix();

-- ── 4. Diagnostic ─────────────────────────────────────────────────
select 'Colonnes ajoutées :' as info;
select table_name, column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'tarifs'     and column_name in ('tva_taux','prix_precedent','prix_precedent_maj'))
     or (table_name = 'menu_plats' and column_name = 'ventes_par_semaine'))
 order by table_name, column_name;

select 'Triggers :' as info;
select trigger_name, event_object_table
  from information_schema.triggers
 where trigger_name = 'tarifs_archive_prix';
