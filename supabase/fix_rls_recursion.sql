-- ============================================================
-- RestoPilot — Fix infinite recursion sur profiles
--
-- Les policies ajoutées au fil du temps (profiles_employe_sees_patron,
-- profiles_select_clients, profiles_select_fournisseurs, is_admin()…)
-- contiennent des sous-requêtes sur profiles elle-même → Postgres
-- déclenche « infinite recursion detected in policy for relation
-- profiles » dès qu'on lit ou écrit une ligne.
--
-- Stratégie : on supprime TOUTES les policies existantes sur profiles
-- et on ne recrée que 4 règles simples, sans récursion. Le check admin
-- utilise auth.jwt() ->> 'role' (claim JWT) au lieu d'une sous-requête
-- sur profiles.
--
-- ⚠ Conséquence : la visibilité patron ↔ employés, fournisseur ↔ clients,
-- etc. passe désormais exclusivement par les API serveur (service_role,
-- qui bypass RLS). Les pages /equipe et /clients doivent interroger via
-- /api/... et non directement le client Supabase browser.
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Purge : supprime toutes les policies existantes sur profiles ─
do $$
declare r record;
begin
  for r in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'profiles'
  loop
    execute format('drop policy if exists %I on profiles', r.policyname);
  end loop;
end$$;

-- ── 2. On s'assure que RLS est activé ──────────────────────────────
alter table profiles enable row level security;

-- ── 3. Nouvelles policies, sans récursion ──────────────────────────
-- SELECT : on lit son propre profil, l'admin lit tout
create policy profiles_select on profiles for select
  using (
    auth.uid() = id
    or (auth.jwt() ->> 'role') = 'admin'
  );

-- INSERT : on ne peut insérer que sa propre ligne profil
create policy profiles_insert on profiles for insert
  with check (auth.uid() = id);

-- UPDATE : on met à jour son propre profil, l'admin met à jour tout
create policy profiles_update on profiles for update
  using (
    auth.uid() = id
    or (auth.jwt() ->> 'role') = 'admin'
  )
  with check (
    auth.uid() = id
    or (auth.jwt() ->> 'role') = 'admin'
  );

-- DELETE : réservé à l'admin (les employés sont supprimés côté serveur
-- via service_role, donc aucune règle RLS n'est évaluée)
create policy profiles_delete on profiles for delete
  using ((auth.jwt() ->> 'role') = 'admin');

-- ── 4. Diagnostic ──────────────────────────────────────────────────
select 'Policies profiles après fix :' as info;
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by cmd, policyname;
