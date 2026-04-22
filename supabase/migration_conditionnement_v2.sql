-- ============================================================
-- RestoPilot — Conditionnement v2 : table unifiée
--
-- Problème résolu : le conditionnement ne pouvait être configuré
-- que sur les produits de la mercuriale fournisseur (tarifs).
-- Les produits issus de l'historique d'achats ou des factures
-- importées (qui n'ont pas d'entrée dans tarifs) étaient exclus.
--
-- Solution : une table unique `produit_conditionnements` keyée par
-- (restaurateur_id, produit_key) — où produit_key est un hash du
-- nom + fournisseur. Elle fonctionne pour toutes les sources.
--
-- Les colonnes tarifs.conditionnement_* (migration_conditionnement.sql)
-- sont conservées pour compatibilité mais ne sont plus utilisées.
-- ============================================================

create table if not exists produit_conditionnements (
  id                     uuid primary key default gen_random_uuid(),
  restaurateur_id        uuid not null references auth.users(id) on delete cascade,
  -- Clé de produit normalisée : nom_lower|fournisseur_id_ou_externe_ou_none
  produit_key            text not null,
  produit_nom            text not null,
  -- Références optionnelles vers les sources (facultatives — la clé est produit_key)
  tarif_id               uuid references tarifs(id) on delete set null,
  fournisseur_id         uuid,
  fournisseur_externe_id uuid,
  -- Prix de référence snapshot au moment de la configuration (persisté pour le trigger)
  prix_reference         numeric(12,2) not null,
  -- Données du conditionnement
  conditionnement_nb     smallint,
  conditionnement_taille numeric(12,3),
  conditionnement_unite  text,
  unite_travail          text,
  prix_unite_travail     numeric(12,4),
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  unique (restaurateur_id, produit_key)
);

create index if not exists pc_resto_idx  on produit_conditionnements(restaurateur_id);
create index if not exists pc_tarif_idx  on produit_conditionnements(tarif_id) where tarif_id is not null;

-- Fonction de calcul (même logique que tarifs_compute_prix_unite_travail)
create or replace function pc_compute_prix_unite_travail()
returns trigger
language plpgsql
as $$
declare
  v_content_total numeric;
  v_factor        numeric;
begin
  if new.conditionnement_nb is null
     or new.conditionnement_taille is null
     or new.unite_travail is null
     or new.conditionnement_unite is null
     or new.prix_reference is null
     or new.prix_reference <= 0
  then
    new.prix_unite_travail := null;
    new.updated_at := now();
    return new;
  end if;

  v_content_total := new.conditionnement_nb * new.conditionnement_taille;
  if v_content_total <= 0 then
    new.prix_unite_travail := null;
    new.updated_at := now();
    return new;
  end if;

  if new.unite_travail in ('piece','pièce','portion')
     or new.unite_travail = new.conditionnement_unite
  then
    new.prix_unite_travail := round((new.prix_reference / new.conditionnement_nb)::numeric, 4);
    new.updated_at := now();
    return new;
  end if;

  v_factor := case
    when new.conditionnement_unite = 'g'  and new.unite_travail = 'kg'  then 1.0 / 1000
    when new.conditionnement_unite = 'kg' and new.unite_travail = 'g'   then 1000
    when new.conditionnement_unite = 'mL' and new.unite_travail = 'L'   then 1.0 / 1000
    when new.conditionnement_unite = 'L'  and new.unite_travail = 'mL'  then 1000
    when new.conditionnement_unite = 'cL' and new.unite_travail = 'L'   then 1.0 / 100
    when new.conditionnement_unite = 'L'  and new.unite_travail = 'cL'  then 100
    when new.conditionnement_unite = 'mL' and new.unite_travail = 'cL'  then 1.0 / 10
    when new.conditionnement_unite = 'cL' and new.unite_travail = 'mL'  then 10
    -- Aliases minuscules pour compat
    when new.conditionnement_unite = 'ml' and new.unite_travail = 'L'   then 1.0 / 1000
    when new.conditionnement_unite = 'L'  and new.unite_travail = 'ml'  then 1000
    when new.conditionnement_unite = 'cl' and new.unite_travail = 'L'   then 1.0 / 100
    when new.conditionnement_unite = 'L'  and new.unite_travail = 'cl'  then 100
    else null
  end;

  if v_factor is null then
    new.prix_unite_travail := round((new.prix_reference / new.conditionnement_nb)::numeric, 4);
    new.updated_at := now();
    return new;
  end if;

  new.prix_unite_travail := round(
    (new.prix_reference / (v_content_total * v_factor))::numeric,
    4
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pc_compute on produit_conditionnements;
create trigger pc_compute
  before insert or update of
    prix_reference, conditionnement_nb, conditionnement_taille,
    conditionnement_unite, unite_travail
  on produit_conditionnements
  for each row execute function pc_compute_prix_unite_travail();

-- ── RLS ───────────────────────────────────────────────────────────
alter table produit_conditionnements enable row level security;

drop policy if exists pc_scope on produit_conditionnements;
create policy pc_scope on produit_conditionnements for all
  using  (restaurateur_id = auth.uid() or is_admin())
  with check (restaurateur_id = auth.uid() or is_admin());

-- ── Migration des données existantes depuis tarifs ────────────────
-- Pour chaque tarif déjà configuré avec un conditionnement, on crée
-- une entrée équivalente dans produit_conditionnements.
-- Clé : nom_lower|fournisseur_id  (format de la fonction produitKey en JS)
insert into produit_conditionnements (
  restaurateur_id, produit_key, produit_nom, tarif_id,
  fournisseur_id, prix_reference,
  conditionnement_nb, conditionnement_taille, conditionnement_unite, unite_travail
)
select distinct on (c.restaurateur_id, t.id)
       c.restaurateur_id,
       lower(p.nom) || '|' || coalesce(t.fournisseur_id::text, 'none')  as produit_key,
       p.nom,
       t.id,
       t.fournisseur_id,
       t.prix,
       t.conditionnement_nb,
       t.conditionnement_taille,
       t.conditionnement_unite,
       t.unite_travail
  from tarifs t
  join produits p on p.id = t.produit_id
  -- On a besoin d'un restaurateur_id : on choisit le 1er restaurateur
  -- ayant déjà commandé ce tarif. Sinon, on skip.
  join lateral (
    select distinct cm.restaurateur_id
      from commandes cm
      join lignes_commande lc on lc.commande_id = cm.id
     where cm.restaurateur_id is not null
       and lower(lc.nom_snapshot) = lower(p.nom)
     limit 1
  ) c on true
 where t.conditionnement_nb is not null
   and t.actif = true
on conflict (restaurateur_id, produit_key) do nothing;

-- ── Diagnostic ────────────────────────────────────────────────────
select 'Table produit_conditionnements :' as info;
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'produit_conditionnements'
 order by ordinal_position;

select 'Policies :' as info;
select policyname, cmd from pg_policies where tablename = 'produit_conditionnements';

select 'Trigger :' as info;
select trigger_name, event_manipulation from information_schema.triggers
 where trigger_name = 'pc_compute';

select 'Lignes migrées depuis tarifs :' as info, count(*)
  from produit_conditionnements where tarif_id is not null;
