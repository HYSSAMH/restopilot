-- ============================================================
-- RestoPilot — Authentification (Supabase Auth)
-- Crée : profiles + trigger auto-provisioning + RLS data-scoping
-- À exécuter après schema.sql (et les autres migrations)
-- ============================================================

-- ── Table profiles ─────────────────────────────────────────────
create table if not exists profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              text not null check (role in ('restaurateur','fournisseur')),
  nom_etablissement text not null,
  prenom            text,
  nom               text,
  email             text not null,
  created_at        timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists profiles_select_self on profiles;
drop policy if exists profiles_update_self on profiles;
create policy profiles_select_self on profiles for select using (id = auth.uid());
create policy profiles_update_self on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ── Trigger : provisioning profil + fournisseur à l'inscription ──
-- Lit raw_user_meta_data ({ role, nom_etablissement, prenom, nom })
-- Crée automatiquement : une ligne profiles, et (si fournisseur)
-- une ligne fournisseurs avec id = auth.users.id.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text := coalesce(new.raw_user_meta_data->>'role', 'restaurateur');
  v_etab   text := coalesce(new.raw_user_meta_data->>'nom_etablissement', 'Mon établissement');
  v_prenom text := new.raw_user_meta_data->>'prenom';
  v_nom    text := new.raw_user_meta_data->>'nom';
begin
  if v_role not in ('restaurateur','fournisseur') then
    v_role := 'restaurateur';
  end if;

  insert into profiles (id, role, nom_etablissement, prenom, nom, email)
  values (new.id, v_role, v_etab, v_prenom, v_nom, new.email)
  on conflict (id) do nothing;

  if v_role = 'fournisseur' then
    insert into fournisseurs (id, nom, initiale, avatar, email, minimum, delai, note)
    values (
      new.id,
      v_etab,
      upper(left(v_etab, 1)),
      'from-violet-600 to-purple-500',
      new.email,
      0, 'J+1', 4.5
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── RLS : data scoping ─────────────────────────────────────────

-- tarifs : le fournisseur gère les siens ; lecture publique conservée pour le catalogue
drop policy if exists tarifs_insert on tarifs;
drop policy if exists tarifs_update on tarifs;
drop policy if exists tarifs_delete on tarifs;
create policy tarifs_insert on tarifs for insert
  with check (fournisseur_id = auth.uid());
create policy tarifs_update on tarifs for update
  using (fournisseur_id = auth.uid()) with check (fournisseur_id = auth.uid());
create policy tarifs_delete on tarifs for delete
  using (fournisseur_id = auth.uid());

-- produits : pas de fournisseur_id direct → les fournisseurs authentifiés peuvent créer/modifier
-- (les suppressions cascade via tarifs → produits.on_delete)
drop policy if exists produits_insert on produits;
drop policy if exists produits_update on produits;
create policy produits_insert on produits for insert
  with check (auth.uid() is not null);
create policy produits_update on produits for update
  using (auth.uid() is not null);

-- fournisseurs : un fournisseur peut mettre à jour sa propre fiche
drop policy if exists fournisseurs_update_self on fournisseurs;
create policy fournisseurs_update_self on fournisseurs for update
  using (id = auth.uid()) with check (id = auth.uid());

-- commandes : le restaurateur voit ses commandes, le fournisseur voit celles qui lui sont passées
drop policy if exists commandes_select on commandes;
drop policy if exists commandes_insert on commandes;
drop policy if exists commandes_update on commandes;
create policy commandes_select on commandes for select
  using (restaurateur_id = auth.uid() or fournisseur_id = auth.uid());
create policy commandes_insert on commandes for insert
  with check (restaurateur_id = auth.uid());
create policy commandes_update on commandes for update
  using (fournisseur_id = auth.uid() or restaurateur_id = auth.uid());

-- lignes_commande : lisible et insérable si la commande parent l'est
drop policy if exists lignes_select on lignes_commande;
drop policy if exists lignes_insert on lignes_commande;
create policy lignes_select on lignes_commande for select
  using (exists (
    select 1 from commandes c
    where c.id = commande_id
      and (c.restaurateur_id = auth.uid() or c.fournisseur_id = auth.uid())
  ));
create policy lignes_insert on lignes_commande for insert
  with check (exists (
    select 1 from commandes c
    where c.id = commande_id
      and c.restaurateur_id = auth.uid()
  ));

-- ── Restaurateur_id sur commandes ──────────────────────────────
-- On verrouille : désormais non null (on garde la colonne nullable au schéma
-- pour ne pas casser l'historique démo, mais les insertions la remplissent).
-- On ajoute un index pour les lookups par user.
create index if not exists commandes_restaurateur_id_idx on commandes(restaurateur_id);
create index if not exists commandes_fournisseur_id_idx  on commandes(fournisseur_id);
create index if not exists tarifs_fournisseur_id_idx     on tarifs(fournisseur_id);
