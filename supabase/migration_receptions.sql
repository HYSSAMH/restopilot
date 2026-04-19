-- ============================================================
-- RestoPilot — Réceptions + colonnes pour historique / rapports
--
-- Ajoute :
--   - statuts "receptionnee" et "receptionnee_avec_anomalies"
--   - sur lignes_commande : quantite_recue, qualite, motif_anomalie
--   - sur commandes : receptionnee_at, avoir_montant
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================================

-- ── 1. Statuts commandes élargis ──────────────────────────
alter table commandes drop constraint if exists commandes_statut_check;
alter table commandes add constraint commandes_statut_check
  check (statut in (
    'recue',
    'en_preparation',
    'en_livraison',
    'livree',
    'receptionnee',
    'receptionnee_avec_anomalies',
    'annulee'
  ));

-- ── 2. Réception ligne par ligne ──────────────────────────
alter table lignes_commande add column if not exists quantite_recue  numeric default null;
alter table lignes_commande add column if not exists qualite         text    default null
  check (qualite is null or qualite in ('conforme','non_conforme'));
alter table lignes_commande add column if not exists motif_anomalie  text    default null;

-- ── 3. Synthèse réception côté commande ───────────────────
alter table commandes add column if not exists receptionnee_at timestamptz default null;
alter table commandes add column if not exists avoir_montant   numeric     default 0;

-- ── 4. Index pour les filtres "à réceptionner" ────────────
create index if not exists commandes_statut_idx     on commandes(statut);
create index if not exists commandes_receptionnee_idx on commandes(receptionnee_at);

-- ── 5. Diagnostic ─────────────────────────────────────────
select 'Colonnes réception :' as info;
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and (
     (table_name = 'commandes' and column_name in ('receptionnee_at','avoir_montant'))
     or (table_name = 'lignes_commande' and column_name in ('quantite_recue','qualite','motif_anomalie'))
   )
 order by table_name, column_name;

select 'Statuts autorisés :' as info;
select conname, pg_get_constraintdef(oid)
  from pg_constraint where conname = 'commandes_statut_check';
