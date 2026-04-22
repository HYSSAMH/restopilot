-- ============================================================
-- RestoPilot — Conditionnement & unité de travail
--
-- PRINCIPE : le prix d'achat original (tarifs.prix) reste intact
-- car il est la référence financière liée à la facture. On ajoute
-- une couche "opérationnelle" qui calcule un prix par unité de
-- travail utilisé dans les fiches techniques.
--
-- Exemple :
--   Un carton de mozzarella à 49,19 € contient 8 paquets de 800 g.
--   L'utilisateur configure :
--     conditionnement_nb     = 8
--     conditionnement_taille = 800
--     conditionnement_unite  = 'g'
--     unite_travail          = 'kg'
--   Le trigger calcule :
--     prix_unite_travail = 49,19 / (8 × 800 × 0.001) = 7,69 €/kg
--
-- Le prix_unite_travail est la valeur injectée dans les fiches
-- techniques pour le coût de revient. Les rapports financiers
-- (historique, trésorerie, factures) continuent d'utiliser prix.
-- ============================================================

-- ── 1. Nouvelles colonnes ─────────────────────────────────────────
alter table tarifs
  add column if not exists conditionnement_nb     smallint,
  add column if not exists conditionnement_taille numeric(12,3),
  add column if not exists conditionnement_unite  text,       -- g, kg, L, cl, ml, piece, portion
  add column if not exists unite_travail          text,       -- kg, g, L, cl, piece, portion
  add column if not exists prix_unite_travail     numeric(12,4);

comment on column tarifs.prix                is 'Prix d''achat original HT (lié à la facture — non modifié par la couche conditionnement).';
comment on column tarifs.prix_unite_travail  is 'Prix calculé par unité de travail (injecté dans les fiches techniques). Recalculé automatiquement par trigger.';

-- ── 2. Fonction de calcul ─────────────────────────────────────────
create or replace function tarifs_compute_prix_unite_travail()
returns trigger
language plpgsql
as $$
declare
  v_content_total numeric;  -- taille totale du conditionnement (nb × taille)
  v_factor        numeric;  -- facteur conditionnement_unite → unite_travail
begin
  -- Si configuration incomplète → pas de prix de travail
  if new.conditionnement_nb is null
     or new.conditionnement_taille is null
     or new.unite_travail is null
     or new.conditionnement_unite is null
     or new.prix is null
     or new.prix <= 0
  then
    new.prix_unite_travail := null;
    return new;
  end if;

  v_content_total := new.conditionnement_nb * new.conditionnement_taille;
  if v_content_total <= 0 then
    new.prix_unite_travail := null;
    return new;
  end if;

  -- Cas « compte » : unité de travail = 1 sous-unité (piece, portion,
  -- ou même nom que conditionnement_unite quand la taille vaut 1)
  if new.unite_travail in ('piece','pièce','portion') then
    new.prix_unite_travail := round((new.prix / new.conditionnement_nb)::numeric, 4);
    return new;
  end if;

  if new.unite_travail = new.conditionnement_unite then
    new.prix_unite_travail := round((new.prix / new.conditionnement_nb)::numeric, 4);
    return new;
  end if;

  -- Conversion poids / volume : combien de `unite_travail` dans 1 `conditionnement_unite`
  v_factor := case
    when new.conditionnement_unite = 'g'  and new.unite_travail = 'kg'  then 1.0 / 1000
    when new.conditionnement_unite = 'kg' and new.unite_travail = 'g'   then 1000
    when new.conditionnement_unite = 'ml' and new.unite_travail = 'L'   then 1.0 / 1000
    when new.conditionnement_unite = 'L'  and new.unite_travail = 'ml'  then 1000
    when new.conditionnement_unite = 'cl' and new.unite_travail = 'L'   then 1.0 / 100
    when new.conditionnement_unite = 'L'  and new.unite_travail = 'cl'  then 100
    when new.conditionnement_unite = 'ml' and new.unite_travail = 'cl'  then 1.0 / 10
    when new.conditionnement_unite = 'cl' and new.unite_travail = 'ml'  then 10
    when new.conditionnement_unite = 'g'  and new.unite_travail = 'g'   then 1
    when new.conditionnement_unite = 'kg' and new.unite_travail = 'kg'  then 1
    when new.conditionnement_unite = 'L'  and new.unite_travail = 'L'   then 1
    else null
  end;

  if v_factor is null then
    -- Conversion inconnue : fallback sur prix par sous-unité
    new.prix_unite_travail := round((new.prix / new.conditionnement_nb)::numeric, 4);
    return new;
  end if;

  -- contenu_total_dans_unite_travail = v_content_total × v_factor
  -- prix par unité de travail = prix / contenu_total_dans_unite_travail
  new.prix_unite_travail := round(
    (new.prix / (v_content_total * v_factor))::numeric,
    4
  );
  return new;
end;
$$;

-- ── 3. Trigger ─────────────────────────────────────────────────────
drop trigger if exists tarifs_compute_unite_travail on tarifs;
create trigger tarifs_compute_unite_travail
  before insert or update of
    prix, conditionnement_nb, conditionnement_taille,
    conditionnement_unite, unite_travail
  on tarifs
  for each row execute function tarifs_compute_prix_unite_travail();

-- ── 4. Diagnostic ─────────────────────────────────────────────────
select 'Colonnes conditionnement :' as info;
select column_name, data_type, numeric_precision, numeric_scale
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'tarifs'
   and column_name in ('conditionnement_nb','conditionnement_taille','conditionnement_unite',
                       'unite_travail','prix_unite_travail')
 order by column_name;

select 'Trigger :' as info;
select trigger_name, event_manipulation, action_timing
  from information_schema.triggers
 where trigger_schema = 'public'
   and trigger_name   = 'tarifs_compute_unite_travail';

-- Test rapide : si vous avez déjà un tarif, testez :
-- update tarifs
--    set conditionnement_nb=8, conditionnement_taille=800, conditionnement_unite='g',
--        unite_travail='kg'
--  where id = 'un_uuid_de_tarif';
-- → prix_unite_travail sera recalculé automatiquement.
