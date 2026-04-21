-- ============================================================
-- RestoPilot — Module Trésorerie
--
-- Tables :
--   • releves_bancaires       : en-tête d'un relevé importé (PDF/CSV)
--   • releve_lignes           : lignes détaillées + pointage polymorphe
--   • charges_recurrentes     : abonnements, loyer, énergie, etc.
--   • charges_paiements       : historique des prélèvements
--   • employes_fiches         : fiches RH (indépendantes de auth)
--   • salaires_mensuels       : détail paie mensuelle par employé
--   • soldes_tout_compte      : départs (démission, licenciement, fin CDD)
--   • depenses_exceptionnelles : achats ponctuels, avec justificatif
--
-- Storage : bucket "justificatifs" (photos / PDFs).
--
-- À exécuter dans Supabase SQL Editor après les autres migrations.
-- ============================================================

-- ── 1. Relevés bancaires ───────────────────────────────────────────
create table if not exists releves_bancaires (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  periode_debut    date not null,
  periode_fin      date not null,
  solde_debut      numeric default 0,
  solde_fin        numeric default 0,
  source           text  default 'manuel',  -- 'pdf' | 'csv' | 'manuel'
  fichier_nom      text,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists releves_resto_idx on releves_bancaires(restaurateur_id, periode_debut desc);

-- Lignes de relevé avec pointage polymorphe
create table if not exists releve_lignes (
  id               uuid primary key default gen_random_uuid(),
  releve_id        uuid not null references releves_bancaires(id) on delete cascade,
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  date_op          date not null,
  libelle          text not null,
  debit            numeric default 0,
  credit           numeric default 0,
  solde            numeric,
  -- Pointage polymorphe : type + id de la ligne RestoPilot associée
  pointe_type      text check (pointe_type in (
                     'facture','charge_paiement','salaire','solde_tout_compte','depense_exceptionnelle','manuel'
                   )),
  pointe_id        uuid,
  pointe_note      text,
  anomalie         boolean default false,
  created_at       timestamptz default now()
);
create index if not exists releve_lignes_releve_idx on releve_lignes(releve_id, date_op);
create index if not exists releve_lignes_pointage_idx on releve_lignes(pointe_type, pointe_id);

-- ── 2. Charges récurrentes ─────────────────────────────────────────
create table if not exists charges_recurrentes (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  nom              text not null,            -- "Loyer", "EDF", "SFR fibre"…
  categorie        text not null,            -- 'loyer','electricite','gaz','eau','assurance','telephone','internet','abonnement','autre'
  montant          numeric not null default 0,
  frequence        text not null check (frequence in ('mensuel','trimestriel','annuel')),
  jour_prelevement smallint,                 -- 1..31 (approximatif)
  actif            boolean default true,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists charges_resto_idx on charges_recurrentes(restaurateur_id, actif);

create table if not exists charges_paiements (
  id               uuid primary key default gen_random_uuid(),
  charge_id        uuid not null references charges_recurrentes(id) on delete cascade,
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  date_prelevement date not null,
  montant          numeric not null,
  reference        text,
  releve_ligne_id  uuid references releve_lignes(id) on delete set null,
  notes            text,
  created_at       timestamptz default now()
);
create index if not exists charges_pmt_resto_idx on charges_paiements(restaurateur_id, date_prelevement desc);

-- ── 3. Masse salariale ─────────────────────────────────────────────
create table if not exists employes_fiches (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  auth_user_id     uuid references auth.users(id) on delete set null,  -- lien optionnel vers compte employé RestoPilot
  prenom           text not null,
  nom              text not null,
  poste            text,                      -- "Serveur", "Chef de partie"…
  type_contrat     text check (type_contrat in ('CDI','CDD','Extra','Apprentissage','Stage')),
  date_embauche    date,
  date_sortie      date,
  actif            boolean default true,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists emp_fiches_resto_idx on employes_fiches(restaurateur_id, actif);

create table if not exists salaires_mensuels (
  id                   uuid primary key default gen_random_uuid(),
  restaurateur_id      uuid not null references auth.users(id) on delete cascade,
  employe_fiche_id     uuid not null references employes_fiches(id) on delete cascade,
  mois                 date not null,          -- 1er du mois (YYYY-MM-01)
  salaire_brut         numeric default 0,
  salaire_net          numeric default 0,
  mode_paiement        text check (mode_paiement in ('virement','especes','cheque')),
  virement_reference   text,
  especes_detail       jsonb default '{}'::jsonb,  -- {50: 5, 20: 10, pieces: 2.50}
  urssaf_montant       numeric default 0,
  urssaf_reference     text,
  prevoyance_montant   numeric default 0,
  prevoyance_nom       text,                   -- "KLESIA", "AG2R"…
  prevoyance_reference text,
  autres_cotisations   jsonb default '[]'::jsonb,  -- [{nom, montant, reference}]
  releve_ligne_id      uuid references releve_lignes(id) on delete set null,
  notes                text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique (employe_fiche_id, mois)
);
create index if not exists salaires_resto_mois_idx on salaires_mensuels(restaurateur_id, mois desc);

create table if not exists soldes_tout_compte (
  id                uuid primary key default gen_random_uuid(),
  restaurateur_id   uuid not null references auth.users(id) on delete cascade,
  employe_fiche_id  uuid not null references employes_fiches(id) on delete cascade,
  date_sortie       date not null,
  montant           numeric not null,
  motif             text check (motif in ('demission','licenciement','fin_cdd','rupture_conventionnelle','autre')),
  mode_paiement     text check (mode_paiement in ('virement','especes','cheque')),
  reference         text,
  releve_ligne_id   uuid references releve_lignes(id) on delete set null,
  notes             text,
  created_at        timestamptz default now()
);
create index if not exists stc_resto_idx on soldes_tout_compte(restaurateur_id, date_sortie desc);

-- ── 4. Dépenses exceptionnelles ────────────────────────────────────
create table if not exists depenses_exceptionnelles (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  date_dep         date not null,
  description      text not null,
  montant          numeric not null,
  categorie        text check (categorie in ('reparation','equipement','formation','mobilier','deco','autre')),
  justificatif_url text,
  releve_ligne_id  uuid references releve_lignes(id) on delete set null,
  notes            text,
  created_at       timestamptz default now()
);
create index if not exists dep_ex_resto_idx on depenses_exceptionnelles(restaurateur_id, date_dep desc);

-- ── 5. RLS ─────────────────────────────────────────────────────────
alter table releves_bancaires        enable row level security;
alter table releve_lignes            enable row level security;
alter table charges_recurrentes      enable row level security;
alter table charges_paiements        enable row level security;
alter table employes_fiches          enable row level security;
alter table salaires_mensuels        enable row level security;
alter table soldes_tout_compte       enable row level security;
alter table depenses_exceptionnelles enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'releves_bancaires','releve_lignes','charges_recurrentes','charges_paiements',
    'employes_fiches','salaires_mensuels','soldes_tout_compte','depenses_exceptionnelles'
  ] loop
    execute format('drop policy if exists %I_scope on %I', t, t);
    execute format($f$
      create policy %I_scope on %I for all
        using (restaurateur_id = auth.uid() or is_admin())
        with check (restaurateur_id = auth.uid() or is_admin())
    $f$, t, t);
  end loop;
end$$;

-- ── 6. Triggers updated_at ─────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'releves_bancaires','charges_recurrentes','employes_fiches','salaires_mensuels'
  ] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end$$;

-- ── 7. Storage : bucket "justificatifs" ────────────────────────────
insert into storage.buckets (id, name, public)
values ('justificatifs', 'justificatifs', false)
on conflict (id) do nothing;

drop policy if exists justificatifs_own_read on storage.objects;
create policy justificatifs_own_read on storage.objects for select
  using (bucket_id = 'justificatifs' and (auth.uid()::text = (storage.foldername(name))[1] or is_admin()));

drop policy if exists justificatifs_own_write on storage.objects;
create policy justificatifs_own_write on storage.objects for insert
  with check (bucket_id = 'justificatifs' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists justificatifs_own_delete on storage.objects;
create policy justificatifs_own_delete on storage.objects for delete
  using (bucket_id = 'justificatifs' and (auth.uid()::text = (storage.foldername(name))[1] or is_admin()));

-- ── 8. Diagnostic ──────────────────────────────────────────────────
select 'Tables trésorerie créées :' as info;
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in (
     'releves_bancaires','releve_lignes','charges_recurrentes','charges_paiements',
     'employes_fiches','salaires_mensuels','soldes_tout_compte','depenses_exceptionnelles'
   )
 order by table_name;

select 'Policies trésorerie :' as info;
select tablename, policyname, cmd
  from pg_policies
 where schemaname='public'
   and tablename in (
     'releves_bancaires','releve_lignes','charges_recurrentes','charges_paiements',
     'employes_fiches','salaires_mensuels','soldes_tout_compte','depenses_exceptionnelles'
   )
 order by tablename;
