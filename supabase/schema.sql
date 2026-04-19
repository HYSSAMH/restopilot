-- ============================================================
-- RestoPilot — Schéma Supabase
-- À exécuter dans l'éditeur SQL Supabase (Settings > SQL Editor)
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

create table if not exists fournisseurs (
  id          uuid primary key default gen_random_uuid(),
  nom         text    not null,
  initiale    char(1) not null,
  avatar      text    not null default 'from-violet-600 to-purple-500',
  email       text,
  minimum     numeric not null default 0,
  delai       text    not null default 'J+1',
  note        numeric not null default 4.5,
  created_at  timestamptz default now()
);

create table if not exists produits (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  categorie   text not null check (categorie in ('legumes','fruits','boucherie','poissonnerie','epicerie')),
  icone       text not null default '📦',
  description text,
  actif       boolean default true,
  created_at  timestamptz default now()
);

create table if not exists tarifs (
  id             uuid primary key default gen_random_uuid(),
  produit_id     uuid references produits(id)    on delete cascade,
  fournisseur_id uuid references fournisseurs(id) on delete cascade,
  prix           numeric not null,
  unite          text    not null,
  actif          boolean default true,
  unique(produit_id, fournisseur_id)
);

create table if not exists commandes (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid,             -- auth.users(id) — nullable pour démo sans login
  restaurateur_nom text not null default 'Le Bistrot Parisien',
  fournisseur_id   uuid references fournisseurs(id),
  statut           text not null default 'recue'
                   check (statut in ('recue','en_preparation','en_livraison','livree','annulee')),
  montant_total    numeric not null,
  note             text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists lignes_commande (
  id             uuid primary key default gen_random_uuid(),
  commande_id    uuid references commandes(id) on delete cascade,
  produit_id     uuid references produits(id),
  nom_snapshot   text    not null,
  prix_snapshot  numeric not null,
  unite          text    not null,
  quantite       integer not null check (quantite > 0)
);

-- ── Trigger updated_at ───────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists commandes_updated_at on commandes;
create trigger commandes_updated_at
  before update on commandes
  for each row execute function set_updated_at();

-- ── Realtime ─────────────────────────────────────────────────
-- Active le suivi temps réel sur la table commandes
alter publication supabase_realtime add table commandes;

-- ── RLS (Row Level Security) ─────────────────────────────────
-- Pour la démo : lecture publique sur le catalogue, accès libre aux commandes
-- À durcir en production avec des policies basées sur auth.uid()

alter table fournisseurs    enable row level security;
alter table produits        enable row level security;
alter table tarifs          enable row level security;
alter table commandes       enable row level security;
alter table lignes_commande enable row level security;

-- Catalogue : lecture publique (anon + authenticated)
create policy "catalogue_read_fournisseurs" on fournisseurs  for select using (true);
create policy "catalogue_read_produits"     on produits      for select using (actif = true);
create policy "catalogue_read_tarifs"       on tarifs        for select using (actif = true);

-- Commandes : lecture/création libres pour la démo
create policy "commandes_select" on commandes       for select using (true);
create policy "commandes_insert" on commandes       for insert with check (true);
create policy "commandes_update" on commandes       for update using (true);
create policy "lignes_select"    on lignes_commande for select using (true);
create policy "lignes_insert"    on lignes_commande for insert with check (true);

-- ── Fournisseur réel (ProFrais Distribution) ─────────────────
-- Les produits sont gérés via /dashboard/fournisseur/mercuriale

insert into fournisseurs (id, nom, initiale, avatar, minimum, delai, note) values
  ('f1000000-0000-0000-0000-000000000001', 'ProFrais Distribution', 'P', 'from-violet-600 to-purple-500', 30, 'J+1', 4.8)
on conflict (id) do nothing;
