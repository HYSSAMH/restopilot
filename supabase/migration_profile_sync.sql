-- ============================================================
-- RestoPilot — Synchronisation profiles → fournisseurs
--
-- `fournisseurs.nom` et `fournisseurs.initiale` sont affichés
-- par le catalogue restaurateur (via la jointure sur tarifs).
-- Pour que les mises à jour de `profiles.nom_commercial` se
-- propagent instantanément au catalogue de TOUS les
-- restaurateurs, un trigger recopie à chaque UPDATE du profil.
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

create or replace function sync_profile_to_fournisseur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display text;
begin
  -- Ne s'applique qu'aux profils de rôle fournisseur
  if new.role <> 'fournisseur' then
    return new;
  end if;

  v_display := coalesce(
    nullif(trim(new.nom_commercial),    ''),
    nullif(trim(new.nom_etablissement), ''),
    'Mon activité'
  );

  update fournisseurs
     set nom      = v_display,
         initiale = upper(left(v_display, 1)),
         email    = coalesce(nullif(trim(new.email_contact), ''), new.email, fournisseurs.email)
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_profile_updated_sync_fournisseur on profiles;
create trigger on_profile_updated_sync_fournisseur
  after update on profiles
  for each row
  when (
    old.nom_commercial    is distinct from new.nom_commercial
    or old.nom_etablissement is distinct from new.nom_etablissement
    or old.email_contact     is distinct from new.email_contact
  )
  execute function sync_profile_to_fournisseur();

-- Synchronisation initiale : on propage les profils existants
update fournisseurs f
   set nom = coalesce(
             nullif(trim(p.nom_commercial),    ''),
             nullif(trim(p.nom_etablissement), ''),
             f.nom
           ),
       initiale = upper(left(coalesce(
             nullif(trim(p.nom_commercial),    ''),
             nullif(trim(p.nom_etablissement), ''),
             f.nom
           ), 1))
  from profiles p
 where p.id = f.id
   and p.role = 'fournisseur';

-- Diagnostic
select 'Trigger sync installé :' as info;
select tgname, tgrelid::regclass, proname
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
 where tgname = 'on_profile_updated_sync_fournisseur';

select 'Fournisseurs synchronisés :' as info;
select f.id, f.nom, p.nom_commercial, p.nom_etablissement
  from fournisseurs f
  left join profiles p on p.id = f.id
 order by f.nom;
