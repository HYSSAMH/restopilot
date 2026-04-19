-- ============================================================
-- RestoPilot — Archivage (soft-delete) des tarifs et produits
--
-- Règle : quand un fournisseur est supprimé (via cascade depuis
-- auth.users, ou directement), ses TARIFS et PRODUITS sont
-- archivés (archived_at = now()) plutôt que supprimés.
-- Commandes + lignes_commande gardent leur CASCADE.
--
-- À exécuter après migration_cascade.sql dans le SQL Editor.
-- ============================================================

-- ── 1. Colonnes archived_at ─────────────────────────────────
alter table tarifs   add column if not exists archived_at timestamptz default null;
alter table produits add column if not exists archived_at timestamptz default null;

-- Snapshot du fournisseur d'origine (conservé après archive)
alter table tarifs add column if not exists fournisseur_id_snapshot uuid default null;

-- Index de perf pour les filtres "non-archivés"
create index if not exists tarifs_active_idx
  on tarifs(fournisseur_id) where archived_at is null;
create index if not exists produits_active_idx
  on produits(id) where archived_at is null;

-- ── 2. Changer la cascade tarifs → fournisseurs ─────────────
-- Avant : ON DELETE CASCADE (supprimait les tarifs)
-- Après : ON DELETE SET NULL (filet de sécurité ; en pratique
-- le trigger ci-dessous nulle déjà la colonne avant que le FK
-- n'ait à intervenir)
alter table tarifs drop constraint if exists tarifs_fournisseur_id_fkey;
alter table tarifs
  add constraint tarifs_fournisseur_id_fkey
  foreign key (fournisseur_id) references fournisseurs(id)
  on delete set null;

-- ── 3. Nettoyer l'ancien trigger de suppression des produits ─
-- (venait de migration_cascade.sql, il supprimait les produits
-- orphelins — on veut les archiver maintenant)
drop trigger  if exists on_tarif_deleted on tarifs;
drop function if exists delete_orphan_produits();

-- ── 4. Trigger BEFORE DELETE sur fournisseurs ───────────────
-- S'exécute avant la cascade. Archive tarifs + produits,
-- snapshot le fournisseur_id, puis détache la FK pour que la
-- cascade SET NULL n'ait rien à faire.
create or replace function archive_fournisseur_data()
returns trigger
language plpgsql
as $$
begin
  -- Snapshot + archivage de tous les tarifs actifs du fournisseur
  update tarifs
     set fournisseur_id_snapshot = old.id,
         archived_at             = now(),
         actif                   = false
   where fournisseur_id = old.id
     and archived_at is null;

  -- Archivage des produits dont plus aucun fournisseur ACTIF ne
  -- propose de tarif non-archivé
  update produits
     set archived_at = now()
   where archived_at is null
     and id in (
       select distinct t.produit_id
         from tarifs t
        where t.fournisseur_id_snapshot = old.id
          and t.archived_at is not null
     )
     and not exists (
       select 1
         from tarifs t2
        where t2.produit_id     = produits.id
          and t2.fournisseur_id is not null
          and t2.fournisseur_id <> old.id
          and t2.archived_at    is null
     );

  -- Détacher explicitement les tarifs pour éviter la cascade SET NULL
  update tarifs set fournisseur_id = null
   where fournisseur_id = old.id;

  return old;
end;
$$;

drop trigger if exists on_fournisseur_delete on fournisseurs;
create trigger on_fournisseur_delete
  before delete on fournisseurs
  for each row execute function archive_fournisseur_data();

-- ── 5. RLS : les rangées archivées sont invisibles ──────────
-- Catalogue public (restaurateurs) : actif=true ET non-archivé
drop policy if exists catalogue_read_tarifs on tarifs;
create policy catalogue_read_tarifs on tarifs for select
  using (actif = true and archived_at is null);

-- Catalogue public produits : non-archivé uniquement
drop policy if exists catalogue_read_produits on produits;
create policy catalogue_read_produits on produits for select
  using (archived_at is null);

-- Fournisseur peut voir TOUS ses propres tarifs (actifs ET
-- désactivés), mais le filtre "archived_at is null" est appliqué
-- côté client dans la mercuriale (cf. fetchEntries)
drop policy if exists tarifs_select_own on tarifs;
create policy tarifs_select_own on tarifs for select
  using (fournisseur_id = auth.uid());

-- ── 6. Diagnostic ──────────────────────────────────────────
select 'Colonnes archived_at ajoutées :' as info;
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and column_name  = 'archived_at'
 order by table_name;

select 'FK tarifs → fournisseurs :' as info;
select tc.constraint_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
 where tc.table_name = 'tarifs'
   and tc.constraint_type = 'FOREIGN KEY'
   and tc.constraint_name = 'tarifs_fournisseur_id_fkey';

select 'Trigger on_fournisseur_delete :' as info;
select tgname, tgrelid::regclass, proname
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where tgname = 'on_fournisseur_delete';

select 'Policies archivage :' as info;
select tablename, policyname, cmd
  from pg_policies
 where tablename in ('tarifs','produits')
 order by tablename, policyname;

-- ── 7. Test à blanc (décommenter sur un user jetable) ──────
-- select count(*) from tarifs   where archived_at is not null;
-- select count(*) from produits where archived_at is not null;
-- delete from auth.users where id = '<uuid-test>';
-- select count(*) from tarifs   where archived_at is not null;
-- select count(*) from produits where archived_at is not null;
