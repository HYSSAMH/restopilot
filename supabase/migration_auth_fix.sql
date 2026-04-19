-- ============================================================
-- RestoPilot — Fix inscription (complément de migration_auth.sql)
--
-- Problème observé : création de compte fournisseur silencieuse.
-- Causes possibles : trigger absent, trigger qui échoue, RLS qui
-- bloque un INSERT de repli côté client.
--
-- Cette migration :
--  1) ajoute les policies INSERT manquantes sur profiles et
--     fournisseurs (nécessaires si le trigger n'a pas tourné et
--     qu'on veut recréer les lignes depuis le client) ;
--  2) réinstalle le trigger handle_new_user avec une gestion
--     d'erreur qui n'interrompt plus la création du user auth ;
--  3) pose des diagnostics à la fin pour vérifier.
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. RLS : INSERT par le user authentifié ───────────────────
drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid());

drop policy if exists fournisseurs_insert_self on fournisseurs;
create policy fournisseurs_insert_self on fournisseurs for insert
  with check (id = auth.uid());

-- ── 2. Trigger handle_new_user (version robuste) ──────────────
-- On NE laisse plus l'échec du trigger casser la création du user.
-- Les lignes manquantes seront recréées par le client après signUp.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text := coalesce(new.raw_user_meta_data->>'role', 'restaurateur');
  v_etab   text := coalesce(nullif(trim(new.raw_user_meta_data->>'nom_etablissement'), ''), 'Mon établissement');
  v_prenom text := new.raw_user_meta_data->>'prenom';
  v_nom    text := new.raw_user_meta_data->>'nom';
begin
  if v_role not in ('restaurateur','fournisseur') then
    v_role := 'restaurateur';
  end if;

  begin
    insert into profiles (id, role, nom_etablissement, prenom, nom, email)
    values (new.id, v_role, v_etab, v_prenom, v_nom, new.email)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user: insert profiles failed: %', sqlerrm;
  end;

  if v_role = 'fournisseur' then
    begin
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
    exception when others then
      raise warning 'handle_new_user: insert fournisseurs failed: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 3. Diagnostics ────────────────────────────────────────────
-- Liste des policies attendues sur profiles / fournisseurs
select tablename, policyname, cmd
  from pg_policies
 where tablename in ('profiles','fournisseurs')
 order by tablename, policyname;

-- Le trigger est-il bien posé ?
select tgname, tgrelid::regclass as table_name, proname as function_name
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where tgname = 'on_auth_user_created';

-- Combien d'utilisateurs auth vs combien de profiles (détecte les orphelins)
select
  (select count(*) from auth.users)                                 as total_users,
  (select count(*) from profiles)                                   as total_profiles,
  (select count(*) from auth.users u
     where not exists (select 1 from profiles p where p.id = u.id)) as users_sans_profile;
