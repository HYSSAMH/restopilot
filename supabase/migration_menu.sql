-- ============================================================
-- RestoPilot — Module Menu (fiches techniques)
--
-- Tables :
--   menu_categories    : Entrées / Plats / Desserts / Boissons / …
--   menu_plats         : un plat de la carte avec son coût & prix
--   fiche_ingredients  : composition d'un plat (ingrédients + qté)
--
-- Les prix des ingrédients peuvent être liés à un tarif fournisseur
-- (tarif_id) pour synchronisation automatique, ou saisis en dur.
--
-- Storage : bucket "menu-photos" (public) pour les photos de plats.
-- ============================================================

-- ── 1. Catégories ──────────────────────────────────────────────────
create table if not exists menu_categories (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  nom              text not null,
  ordre            smallint default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists menu_cat_resto_idx on menu_categories(restaurateur_id, ordre);

-- ── 2. Plats ───────────────────────────────────────────────────────
create table if not exists menu_plats (
  id                       uuid primary key default gen_random_uuid(),
  restaurateur_id          uuid not null references auth.users(id) on delete cascade,
  categorie_id             uuid references menu_categories(id) on delete set null,

  nom                      text not null,
  description              text,
  photo_url                text,
  temps_preparation_min    smallint,
  allergenes               text[] default '{}'::text[],   -- liste officielle 14 allergènes UE
  portions_par_recette     smallint default 1 check (portions_par_recette > 0),
  instructions             text,

  -- Tarification
  tva_taux                 numeric(5,2) default 10 check (tva_taux in (5.50, 10, 20)),
  marge_souhaitee_pct      numeric(5,2) default 70,
  prix_vente_ttc           numeric(12,2) default 0,

  -- Cache coût (recalculé à chaque modification de la fiche ou sync prix)
  cout_revient_total       numeric(12,2) default 0,
  cout_revient_precedent   numeric(12,2),  -- pour détecter hausses
  cout_revient_calcule_at  timestamptz,

  -- Popularité (saisie manuelle pour l'instant ; calculable plus tard)
  popularite_score         smallint default 0,

  actif                    boolean default true,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
create index if not exists menu_plats_resto_idx       on menu_plats(restaurateur_id, actif);
create index if not exists menu_plats_categorie_idx   on menu_plats(categorie_id);

-- ── 3. Ingrédients d'une fiche ────────────────────────────────────
create table if not exists fiche_ingredients (
  id                    uuid primary key default gen_random_uuid(),
  plat_id               uuid not null references menu_plats(id) on delete cascade,

  -- Lien optionnel vers la mercuriale (sync auto si set)
  tarif_id              uuid references tarifs(id)   on delete set null,
  produit_id            uuid references produits(id) on delete set null,

  nom                   text not null,
  quantite              numeric(12,3) not null check (quantite > 0),
  unite                 text not null,
  prix_unitaire         numeric(12,2) not null default 0,
  cout_total            numeric(12,2) not null default 0,       -- quantite × prix_unitaire

  -- Pour détecter hausse > 5%
  prix_precedent        numeric(12,2),
  prix_derniere_maj     timestamptz,

  ordre                 smallint default 0,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
create index if not exists fiche_ing_plat_idx   on fiche_ingredients(plat_id, ordre);
create index if not exists fiche_ing_tarif_idx  on fiche_ingredients(tarif_id) where tarif_id is not null;

-- ── 4. Trigger : recalcul auto cout_total ingrédient + total plat ─
create or replace function fiche_ing_update_cost()
returns trigger
language plpgsql
as $$
begin
  new.cout_total = round((new.prix_unitaire * new.quantite)::numeric, 2);
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fiche_ing_cost on fiche_ingredients;
create trigger fiche_ing_cost before insert or update on fiche_ingredients
  for each row execute function fiche_ing_update_cost();

-- Trigger : à chaque insert/update/delete d'ingrédient, recalcule
-- cout_revient_total sur le plat parent.
create or replace function plat_recompute_cost()
returns trigger
language plpgsql
as $$
declare
  v_plat_id uuid;
  v_total   numeric(12,2);
  v_prev    numeric(12,2);
begin
  v_plat_id := coalesce(new.plat_id, old.plat_id);
  select coalesce(sum(cout_total), 0)::numeric(12,2)
    into v_total
    from fiche_ingredients
   where plat_id = v_plat_id;

  select cout_revient_total into v_prev from menu_plats where id = v_plat_id;

  update menu_plats
     set cout_revient_precedent = v_prev,
         cout_revient_total     = v_total,
         cout_revient_calcule_at = now(),
         updated_at              = now()
   where id = v_plat_id;
  return null;
end;
$$;

drop trigger if exists fiche_ing_after_change on fiche_ingredients;
create trigger fiche_ing_after_change after insert or update or delete on fiche_ingredients
  for each row execute function plat_recompute_cost();

-- ── 5. Trigger updated_at sur plats et catégories ────────────────
drop trigger if exists menu_cat_updated_at on menu_categories;
create trigger menu_cat_updated_at before update on menu_categories
  for each row execute function set_updated_at();

drop trigger if exists menu_plats_updated_at on menu_plats;
create trigger menu_plats_updated_at before update on menu_plats
  for each row execute function set_updated_at();

-- ── 6. RLS ─────────────────────────────────────────────────────────
alter table menu_categories    enable row level security;
alter table menu_plats         enable row level security;
alter table fiche_ingredients  enable row level security;

drop policy if exists menu_categories_scope on menu_categories;
create policy menu_categories_scope on menu_categories for all
  using  (restaurateur_id = auth.uid() or is_admin())
  with check (restaurateur_id = auth.uid() or is_admin());

drop policy if exists menu_plats_scope on menu_plats;
create policy menu_plats_scope on menu_plats for all
  using  (restaurateur_id = auth.uid() or is_admin())
  with check (restaurateur_id = auth.uid() or is_admin());

-- fiche_ingredients : scope indirect via plat_id
drop policy if exists fiche_ing_scope on fiche_ingredients;
create policy fiche_ing_scope on fiche_ingredients for all
  using (
    exists (
      select 1 from menu_plats p
       where p.id = fiche_ingredients.plat_id
         and (p.restaurateur_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from menu_plats p
       where p.id = fiche_ingredients.plat_id
         and (p.restaurateur_id = auth.uid() or is_admin())
    )
  );

-- ── 7. Storage : bucket "menu-photos" (public) ─────────────────────
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

drop policy if exists menu_photos_public_read on storage.objects;
create policy menu_photos_public_read on storage.objects for select
  using (bucket_id = 'menu-photos');

drop policy if exists menu_photos_own_write on storage.objects;
create policy menu_photos_own_write on storage.objects for insert
  with check (bucket_id = 'menu-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists menu_photos_own_delete on storage.objects;
create policy menu_photos_own_delete on storage.objects for delete
  using (bucket_id = 'menu-photos' and (auth.uid()::text = (storage.foldername(name))[1] or is_admin()));

-- ── 8. Diagnostic ─────────────────────────────────────────────────
select 'Tables menu créées :' as info;
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('menu_categories','menu_plats','fiche_ingredients')
 order by table_name;

select 'Policies :' as info;
select tablename, policyname, cmd from pg_policies
 where tablename in ('menu_categories','menu_plats','fiche_ingredients')
 order by tablename, policyname;

select 'Bucket menu-photos :' as info;
select id, public from storage.buckets where id='menu-photos';
