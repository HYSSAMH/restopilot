-- ============================================================
-- RestoPilot — Bucket "factures-externes"
--
-- Stocke les PDF originaux des factures importées pour permettre
-- la consultation et le téléchargement ultérieurs depuis la page
-- /dashboard/restaurateur/factures.
--
-- On ajoute aussi une colonne `pdf_path` sur `commandes` pour
-- référencer le fichier (les factures importées sont stockées
-- comme des commandes avec source='import').
-- ============================================================

-- ── 1. Colonne pdf_path ──────────────────────────────────────────
alter table commandes
  add column if not exists pdf_path text;

comment on column commandes.pdf_path is
  'Chemin du PDF source dans storage.factures-externes (présent pour les commandes source=import).';

-- ── 2. Storage bucket ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('factures-externes', 'factures-externes', false)
on conflict (id) do nothing;

-- Le préfixe du path = restaurateur_id (comme pour les autres buckets
-- privés). RLS : seul le propriétaire peut lire / écrire.
drop policy if exists fe_own_read on storage.objects;
create policy fe_own_read on storage.objects for select
  using (
    bucket_id = 'factures-externes'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_admin())
  );

drop policy if exists fe_own_write on storage.objects;
create policy fe_own_write on storage.objects for insert
  with check (
    bucket_id = 'factures-externes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists fe_own_delete on storage.objects;
create policy fe_own_delete on storage.objects for delete
  using (
    bucket_id = 'factures-externes'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_admin())
  );

-- ── 3. Diagnostic ────────────────────────────────────────────────
select 'Bucket factures-externes :' as info;
select id, public from storage.buckets where id = 'factures-externes';
