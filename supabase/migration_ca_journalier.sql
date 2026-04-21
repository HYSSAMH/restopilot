-- ============================================================
-- RestoPilot — Saisie du CA (journalier ou mensuel)
--
-- Table ca_journalier : une ligne par (restaurateur, date).
--   - mode_saisie='journalier' → date = jour précis
--   - mode_saisie='mensuel'    → date = 1er du mois (YYYY-MM-01)
--
-- Détail par mode de paiement stocké en JSONB (structures libres).
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

create table if not exists ca_journalier (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  mode_saisie      text not null check (mode_saisie in ('mensuel','journalier')),

  -- Espèces : { "50": 2, "20": 5, "10": 3, "5": 4, "pieces": 12.50 }
  especes_detail   jsonb  default '{}'::jsonb,
  especes_total    numeric default 0,

  -- Carte bancaire : montant + n° remise
  cb_montant       numeric default 0,
  cb_reference     text,

  -- Tickets restaurant : [ { emetteur, nb, valeur, total } , … ]
  tr_detail        jsonb  default '[]'::jsonb,
  tr_total         numeric default 0,

  -- Autres : [ { mode: 'virement'|'cheque'|…, montant, reference } , … ]
  autres_detail    jsonb  default '[]'::jsonb,
  autres_total     numeric default 0,

  -- Total (calculé côté client + stocké pour requêtes rapides)
  ca_total         numeric default 0,
  notes            text,

  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  unique (restaurateur_id, date)
);

create index if not exists ca_resto_date_idx on ca_journalier(restaurateur_id, date);

alter table ca_journalier enable row level security;

drop policy if exists ca_own on ca_journalier;
create policy ca_own on ca_journalier for all
  using (restaurateur_id = auth.uid() or is_admin())
  with check (restaurateur_id = auth.uid() or is_admin());

drop trigger if exists ca_updated_at on ca_journalier;
create trigger ca_updated_at before update on ca_journalier
  for each row execute function set_updated_at();

-- Diagnostic
select 'Table ca_journalier créée :' as info;
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'ca_journalier'
 order by ordinal_position;
