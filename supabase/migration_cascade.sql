-- ============================================================
-- RestoPilot — CASCADE DELETE propre sur auth.users
--
-- Objectif : supprimer un utilisateur dans auth.users doit
-- supprimer automatiquement TOUTES ses données applicatives.
--
-- Chaîne cible après migration :
--
--   auth.users
--     ├── profiles                  (FK cascade — déjà en place)
--     ├── fournisseurs              (FK cascade ajouté ici)
--     │    ├── tarifs               (FK cascade — déjà en place)
--     │    │    └── produits orphelins  (trigger ajouté ici)
--     │    └── commandes            (FK cascade renforcé ici)
--     │         └── lignes_commande (FK cascade — déjà en place)
--     └── commandes (côté restaurateur)  (FK cascade ajouté ici)
--          └── lignes_commande      (FK cascade)
--
-- À exécuter dans Supabase SQL Editor après migration_auth_fix.sql.
-- ============================================================

-- ── 1. fournisseurs.id → auth.users.id (CASCADE) ────────────
-- NOT VALID : on n'échoue pas sur les lignes démo existantes
-- (ex: f1000000-… qui n'a pas de user auth correspondant).
-- Les NOUVELLES lignes sont validées, la cascade fonctionne
-- dès qu'un user réel est lié.
alter table fournisseurs drop constraint if exists fournisseurs_user_fk;
alter table fournisseurs
  add constraint fournisseurs_user_fk
  foreign key (id) references auth.users(id)
  on delete cascade
  not valid;

-- ── 2. commandes.restaurateur_id → auth.users.id (CASCADE) ──
alter table commandes drop constraint if exists commandes_restaurateur_fk;
alter table commandes
  add constraint commandes_restaurateur_fk
  foreign key (restaurateur_id) references auth.users(id)
  on delete cascade
  not valid;

-- ── 3. commandes.fournisseur_id : renforcer en CASCADE ──────
alter table commandes drop constraint if exists commandes_fournisseur_id_fkey;
alter table commandes
  add constraint commandes_fournisseur_id_fkey
  foreign key (fournisseur_id) references fournisseurs(id)
  on delete cascade;

-- ── 4. lignes_commande.produit_id : verrou RESTRICT explicite ─
-- On NE veut PAS qu'un delete produit tue silencieusement
-- l'historique de lignes. Le nettoyage passe par le trigger.
alter table lignes_commande drop constraint if exists lignes_commande_produit_id_fkey;
alter table lignes_commande
  add constraint lignes_commande_produit_id_fkey
  foreign key (produit_id) references produits(id)
  on delete restrict;

-- ── 5. Trigger : purge les produits orphelins ───────────────
-- Après chaque DELETE sur tarifs, si le produit lié n'a plus
-- aucun tarif ET n'est plus référencé par l'historique de
-- lignes_commande, on le supprime.
create or replace function delete_orphan_produits()
returns trigger
language plpgsql
as $$
begin
  delete from produits p
   where p.id = old.produit_id
     and not exists (select 1 from tarifs           where produit_id = old.produit_id)
     and not exists (select 1 from lignes_commande where produit_id = old.produit_id);
  return old;
end;
$$;

drop trigger if exists on_tarif_deleted on tarifs;
create trigger on_tarif_deleted
  after delete on tarifs
  for each row execute function delete_orphan_produits();

-- ── 6. Fonction "suppression totale" — admin ────────────────
-- Supprime un utilisateur + TOUTES ses données d'un coup.
-- Security definer : contourne RLS et s'exécute en postgres.
-- Usage : select delete_user_cascade('<uuid>');
create or replace function delete_user_cascade(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Tout descend en cascade grâce aux FK ci-dessus :
  --   auth.users → profiles, fournisseurs, commandes (restaurateur_id)
  --   fournisseurs → tarifs, commandes (fournisseur_id)
  --   commandes → lignes_commande
  --   trigger on_tarif_deleted → produits orphelins
  delete from auth.users where id = p_user_id;
end;
$$;

revoke execute on function delete_user_cascade(uuid) from public;
revoke execute on function delete_user_cascade(uuid) from anon, authenticated;

-- ── 7. Fonction self-service : "supprimer mon compte" ───────
-- Un utilisateur connecté peut supprimer son propre compte
-- depuis l'app. Utilise auth.uid() — aucun param.
create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;
  delete from auth.users where id = v_user_id;
end;
$$;

grant execute on function delete_my_account() to authenticated;

-- ============================================================
-- ── 8. Diagnostic : vérifier l'état des FK ──────────────────
-- ============================================================
select
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema || '.' || ccu.table_name || '.' || ccu.column_name as references_col,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('profiles','fournisseurs','produits','tarifs','commandes','lignes_commande')
order by tc.table_name, tc.constraint_name;

-- Test "à blanc" (décommenter pour tester sur un vrai user)
--   select delete_user_cascade('<user-uuid-ici>');
