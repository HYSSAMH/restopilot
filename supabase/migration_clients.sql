-- ============================================================
-- RestoPilot — Gestion clients côté fournisseur
--
-- Tables :
--   - paiements : encaissements reçus sur une commande
--   - clients_fournisseur : notes + conditions commerciales
--     spécifiques à la relation fournisseur ↔ restaurateur
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Table paiements ─────────────────────────────────────
create table if not exists paiements (
  id               uuid primary key default gen_random_uuid(),
  commande_id      uuid references commandes(id) on delete cascade,
  fournisseur_id   uuid not null,
  restaurateur_id  uuid,
  montant          numeric not null check (montant > 0),
  mode             text check (mode in ('virement','cheque','especes','carte','autre')),
  reference        text,
  notes            text,
  created_at       timestamptz default now()
);

create index if not exists paiements_fournisseur_idx     on paiements(fournisseur_id);
create index if not exists paiements_restaurateur_idx    on paiements(restaurateur_id);
create index if not exists paiements_commande_idx        on paiements(commande_id);

-- ── 2. Table clients_fournisseur (conditions commerciales) ─
create table if not exists clients_fournisseur (
  fournisseur_id       uuid not null references profiles(id) on delete cascade,
  restaurateur_id      uuid not null references profiles(id) on delete cascade,
  delai_paiement_jours integer default 30 check (delai_paiement_jours >= 0),
  remise_pct           numeric default 0  check (remise_pct >= 0 and remise_pct <= 100),
  montant_min          numeric default 0,
  notes                text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  primary key (fournisseur_id, restaurateur_id)
);

-- ── 3. RLS ─────────────────────────────────────────────────
alter table paiements            enable row level security;
alter table clients_fournisseur  enable row level security;

-- paiements : accès par fournisseur + restaurateur concernés
drop policy if exists paiements_select on paiements;
create policy paiements_select on paiements for select
  using (fournisseur_id = auth.uid() or restaurateur_id = auth.uid() or is_admin());

-- Insert, update, delete : uniquement par le fournisseur
drop policy if exists paiements_insert on paiements;
drop policy if exists paiements_update on paiements;
drop policy if exists paiements_delete on paiements;
create policy paiements_insert on paiements for insert
  with check (fournisseur_id = auth.uid() or is_admin());
create policy paiements_update on paiements for update
  using (fournisseur_id = auth.uid() or is_admin())
  with check (fournisseur_id = auth.uid() or is_admin());
create policy paiements_delete on paiements for delete
  using (fournisseur_id = auth.uid() or is_admin());

-- clients_fournisseur : uniquement le fournisseur concerné
drop policy if exists cf_select on clients_fournisseur;
drop policy if exists cf_insert on clients_fournisseur;
drop policy if exists cf_update on clients_fournisseur;
drop policy if exists cf_delete on clients_fournisseur;
create policy cf_select on clients_fournisseur for select
  using (fournisseur_id = auth.uid() or is_admin());
create policy cf_insert on clients_fournisseur for insert
  with check (fournisseur_id = auth.uid() or is_admin());
create policy cf_update on clients_fournisseur for update
  using (fournisseur_id = auth.uid() or is_admin())
  with check (fournisseur_id = auth.uid() or is_admin());
create policy cf_delete on clients_fournisseur for delete
  using (fournisseur_id = auth.uid() or is_admin());

-- ── 4. Trigger updated_at ──────────────────────────────────
drop trigger if exists cf_updated_at on clients_fournisseur;
create trigger cf_updated_at
  before update on clients_fournisseur
  for each row execute function set_updated_at();

-- ── 5. Diagnostic ──────────────────────────────────────────
select 'Tables :' as info;
select table_name from information_schema.tables
 where table_schema = 'public' and table_name in ('paiements','clients_fournisseur');

select 'Policies :' as info;
select tablename, policyname, cmd from pg_policies
 where tablename in ('paiements','clients_fournisseur')
 order by tablename, policyname;
