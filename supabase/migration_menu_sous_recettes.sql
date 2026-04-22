-- ============================================================
-- RestoPilot — Sous-recettes dans les fiches techniques
--
-- Une fiche peut utiliser une autre fiche comme ingrédient.
-- Le coût par portion de la sous-recette est injecté comme
-- prix unitaire de l'ingrédient. Un trigger en cascade
-- propage les changements de coût dans tout l'arbre.
--
-- Garde-fou anti-cycle : on rejette toute tentative qui
-- ferait qu'un plat se retrouve (directement ou indirectement)
-- dans ses propres descendants.
--
-- Dépend de : migration_menu.sql (tables menu_plats + fiche_ingredients)
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Colonne sous_recette_id ─────────────────────────────────────
alter table fiche_ingredients
  add column if not exists sous_recette_id uuid references menu_plats(id) on delete set null;

-- Empêche une fiche de se référencer elle-même directement
alter table fiche_ingredients drop constraint if exists fi_not_self;
alter table fiche_ingredients
  add constraint fi_not_self check (
    sous_recette_id is null or plat_id <> sous_recette_id
  );

create index if not exists fiche_ing_sous_recette_idx
  on fiche_ingredients(sous_recette_id)
 where sous_recette_id is not null;

-- ── 2. Anti-cycle : BEFORE INSERT/UPDATE ───────────────────────────
create or replace function prevent_sous_recette_cycle()
returns trigger
language plpgsql
as $$
declare
  v_parent uuid;
  v_target uuid;
  v_cycle  boolean;
begin
  if new.sous_recette_id is null then
    return new;
  end if;

  v_parent := new.plat_id;
  v_target := new.sous_recette_id;

  if v_parent = v_target then
    raise exception 'Cycle : une fiche ne peut pas s''utiliser elle-même comme sous-recette.';
  end if;

  -- Descendants de la sous-recette cible (jusqu'à 10 niveaux pour borner)
  with recursive desc_set as (
    select sous_recette_id as pid, 1 as depth
      from fiche_ingredients
     where plat_id = v_target and sous_recette_id is not null
    union all
    select fi.sous_recette_id, d.depth + 1
      from fiche_ingredients fi
      join desc_set d on fi.plat_id = d.pid
     where fi.sous_recette_id is not null
       and d.depth < 10
  )
  select exists(select 1 from desc_set where pid = v_parent) into v_cycle;

  if v_cycle then
    raise exception 'Cycle détecté : cette sous-recette contient déjà le plat parent plus bas dans l''arbre.';
  end if;

  return new;
end;
$$;

drop trigger if exists fiche_ing_no_cycle on fiche_ingredients;
create trigger fiche_ing_no_cycle
  before insert or update of sous_recette_id, plat_id on fiche_ingredients
  for each row execute function prevent_sous_recette_cycle();

-- ── 3. Cascade coût : quand cout_revient_total d'un plat change, ──
--    on propage le nouveau prix par portion à tous les
--    fiche_ingredients qui l'utilisent comme sous_recette.
--    L'update déclenche fiche_ing_update_cost (recalc cout_total)
--    puis plat_recompute_cost (recalc plat parent) → cascade
--    naturelle sans boucle grâce à IS DISTINCT FROM.
create or replace function cascade_sous_recette_cost()
returns trigger
language plpgsql
as $$
declare
  v_new_portion_cost numeric(12,2);
begin
  if new.cout_revient_total is distinct from old.cout_revient_total
     or new.portions_par_recette is distinct from old.portions_par_recette
  then
    v_new_portion_cost := case
      when new.portions_par_recette > 0
      then round((new.cout_revient_total / new.portions_par_recette)::numeric, 2)
      else 0
    end;

    update fiche_ingredients
       set prix_precedent    = prix_unitaire,
           prix_unitaire     = v_new_portion_cost,
           prix_derniere_maj = now()
     where sous_recette_id = new.id
       and prix_unitaire is distinct from v_new_portion_cost;
  end if;
  return new;
end;
$$;

drop trigger if exists menu_plats_cascade_cost on menu_plats;
create trigger menu_plats_cascade_cost
  after update of cout_revient_total, portions_par_recette on menu_plats
  for each row execute function cascade_sous_recette_cost();

-- ── 4. Diagnostic ─────────────────────────────────────────────────
select 'Colonne sous_recette_id :' as info;
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'fiche_ingredients'
   and column_name  = 'sous_recette_id';

select 'Triggers fiche_ingredients / menu_plats :' as info;
select event_object_table as tbl, trigger_name, event_manipulation
  from information_schema.triggers
 where trigger_schema = 'public'
   and event_object_table in ('fiche_ingredients','menu_plats')
 order by event_object_table, trigger_name;
