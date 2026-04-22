-- ============================================================
-- RestoPilot — Sprint 1 hardening (version tolérante)
--
-- Regroupe 3 corrections critiques avant production :
--   #2 Précision numérique (numeric(12,2)) sur tous les montants
--   #3 FK manquante commandes.restaurateur_id → auth.users
--   #5 RLS durcie sur commandes et lignes_commande
--
-- Chaque ALTER COLUMN est wrappé dans un bloc PL/pgSQL qui vérifie
-- l'existence de la colonne avant d'agir — ainsi la migration passe
-- même si certaines tables (issues de migrations non encore jouées)
-- sont absentes. Idempotente : rejouable sans casse.
-- ============================================================

-- ============================================================
-- #2 : Montants / prix / salaires → numeric(12,2)
-- ============================================================

do $$
declare
  cols text[][] := array[
    -- schema.sql (core)
    array['fournisseurs',            'minimum'],
    array['tarifs',                  'prix'],
    array['tarifs',                  'ancien_prix'],
    array['commandes',               'montant_total'],
    array['commandes',               'avoir_montant'],
    array['lignes_commande',         'prix_snapshot'],
    -- migration_profile.sql
    array['profiles',                'montant_minimum_commande'],
    -- migration_ca_journalier.sql
    array['ca_journalier',           'especes_total'],
    array['ca_journalier',           'cb_montant'],
    array['ca_journalier',           'tr_total'],
    array['ca_journalier',           'autres_total'],
    array['ca_journalier',           'ca_total'],
    -- migration_clients.sql
    array['paiements',               'montant'],
    array['clients_fournisseur',     'montant_min'],
    -- migration_tresorerie.sql
    array['releves_bancaires',       'solde_debut'],
    array['releves_bancaires',       'solde_fin'],
    array['releve_lignes',           'debit'],
    array['releve_lignes',           'credit'],
    array['releve_lignes',           'solde'],
    array['charges_recurrentes',     'montant'],
    array['charges_paiements',       'montant'],
    array['salaires_mensuels',       'salaire_brut'],
    array['salaires_mensuels',       'salaire_net'],
    array['salaires_mensuels',       'urssaf_montant'],
    array['salaires_mensuels',       'prevoyance_montant'],
    array['soldes_tout_compte',      'montant'],
    array['depenses_exceptionnelles','montant']
  ];
  r     text[];
  tbl   text;
  col   text;
  exists_col boolean;
  current_scale int;
begin
  foreach r slice 1 in array cols loop
    tbl := r[1];
    col := r[2];
    -- La colonne existe-t-elle ?
    select exists(
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name   = tbl
         and column_name  = col
    ) into exists_col;

    if not exists_col then
      raise notice '↷ skip : %.% n''existe pas', tbl, col;
      continue;
    end if;

    -- Déjà en (x,2) ? on skip
    select numeric_scale into current_scale
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = tbl
       and column_name  = col;

    if current_scale = 2 then
      raise notice '✓ déjà numeric(_,2) : %.%', tbl, col;
      continue;
    end if;

    execute format(
      'alter table %I alter column %I type numeric(12,2) using %I::numeric(12,2)',
      tbl, col, col
    );
    raise notice '✔ converti : %.% → numeric(12,2)', tbl, col;
  end loop;
end$$;

-- ============================================================
-- #3 : FK commandes.restaurateur_id → auth.users
-- ============================================================

-- Purge orphelins (commandes dont le restaurateur n'existe plus)
delete from commandes c
 where c.restaurateur_id is not null
   and not exists (
     select 1 from auth.users u where u.id = c.restaurateur_id
   );

-- Ajout FK (idempotent)
alter table commandes drop constraint if exists commandes_restaurateur_fk;
alter table commandes
  add constraint commandes_restaurateur_fk
  foreign key (restaurateur_id) references auth.users(id)
  on delete cascade;

-- ============================================================
-- #5 : RLS durcie sur commandes + lignes_commande
-- ============================================================

-- Purge des policies existantes (permissives ou non)
do $$
declare r record;
begin
  for r in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('commandes','lignes_commande')
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end$$;

-- ── commandes ──
create policy commandes_select on commandes for select
  using (
    restaurateur_id = auth.uid()
    or fournisseur_id = auth.uid()
    or is_admin()
  );

create policy commandes_insert on commandes for insert
  with check (
    restaurateur_id = auth.uid()
    or is_admin()
  );

create policy commandes_update on commandes for update
  using (
    restaurateur_id = auth.uid()
    or fournisseur_id = auth.uid()
    or is_admin()
  )
  with check (
    restaurateur_id = auth.uid()
    or fournisseur_id = auth.uid()
    or is_admin()
  );

create policy commandes_delete on commandes for delete
  using (
    restaurateur_id = auth.uid()
    or is_admin()
  );

-- ── lignes_commande (scope indirect via commande parent) ──
create policy lignes_select on lignes_commande for select
  using (
    exists (
      select 1 from commandes c
       where c.id = lignes_commande.commande_id
         and (c.restaurateur_id = auth.uid()
              or c.fournisseur_id = auth.uid()
              or is_admin())
    )
  );

create policy lignes_insert on lignes_commande for insert
  with check (
    exists (
      select 1 from commandes c
       where c.id = lignes_commande.commande_id
         and (c.restaurateur_id = auth.uid() or is_admin())
    )
  );

create policy lignes_update on lignes_commande for update
  using (
    exists (
      select 1 from commandes c
       where c.id = lignes_commande.commande_id
         and (c.restaurateur_id = auth.uid()
              or c.fournisseur_id = auth.uid()
              or is_admin())
    )
  )
  with check (
    exists (
      select 1 from commandes c
       where c.id = lignes_commande.commande_id
         and (c.restaurateur_id = auth.uid()
              or c.fournisseur_id = auth.uid()
              or is_admin())
    )
  );

create policy lignes_delete on lignes_commande for delete
  using (
    exists (
      select 1 from commandes c
       where c.id = lignes_commande.commande_id
         and (c.restaurateur_id = auth.uid() or is_admin())
    )
  );

-- ============================================================
-- Diagnostic
-- ============================================================

select 'Colonnes numeric(12,2) après migration :' as info;
select table_name, column_name, numeric_precision, numeric_scale
  from information_schema.columns
 where table_schema = 'public'
   and data_type = 'numeric'
   and numeric_scale = 2
 order by table_name, column_name;

select 'FK commandes.restaurateur_id :' as info;
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conname = 'commandes_restaurateur_fk';

select 'Policies commandes + lignes_commande :' as info;
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('commandes','lignes_commande')
 order by tablename, policyname;
