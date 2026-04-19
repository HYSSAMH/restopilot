-- ============================================================
-- RestoPilot — Migration mercuriale
-- À exécuter dans l'éditeur SQL Supabase après schema.sql
-- ============================================================

-- Stock et date de création sur les tarifs
alter table tarifs add column if not exists stock     integer      default null;
alter table tarifs add column if not exists created_at timestamptz default now();

-- RLS : le fournisseur peut gérer ses propres tarifs (démo : accès total)
create policy "tarifs_insert" on tarifs for insert with check (true);
create policy "tarifs_update" on tarifs for update using (true);
create policy "tarifs_delete" on tarifs for delete using (true);

-- RLS : les fournisseurs peuvent créer/modifier des produits
create policy "produits_insert" on produits for insert with check (true);
create policy "produits_update" on produits for update using (true);

-- Lecture des produits inactifs (pour l'interface fournisseur)
-- On remplace la policy restrictive par une policy permissive en lecture
drop policy if exists "catalogue_read_produits" on produits;
create policy "catalogue_read_produits" on produits for select using (true);
