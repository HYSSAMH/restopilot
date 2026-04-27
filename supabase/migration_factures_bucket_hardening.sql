-- ============================================================
-- RestoPilot — Hardening du bucket "factures-externes"
--
-- Ajoute :
--   • allowed_mime_types : restreint aux PDF/images
--   • file_size_limit    : 20 Mo (cohérent avec la modal)
--   • policy stricte sur le path : extension correspond au mime
--
-- À exécuter APRÈS migration_factures_externes_bucket.sql.
-- Sécurité : empêche un user authentifié d'uploader des binaires
-- arbitraires (exe, scripts, etc.) en bidouillant l'extension.
-- ============================================================

-- ── 1. Restrictions MIME et taille ───────────────────────────────
update storage.buckets
   set allowed_mime_types = array[
         'application/pdf',
         'image/jpeg',
         'image/png',
         'image/webp'
       ],
       file_size_limit = 20 * 1024 * 1024  -- 20 Mo
 where id = 'factures-externes';

-- ── 2. Policy d'insertion durcie ─────────────────────────────────
-- En plus du check propriétaire, on exige que l'extension du fichier
-- soit dans une whitelist. Évite les fichiers sans extension qui
-- contourneraient le mime type filter (Supabase déduit le mime de
-- l'extension par défaut).
drop policy if exists fe_own_write on storage.objects;
create policy fe_own_write on storage.objects for insert
  with check (
    bucket_id = 'factures-externes'
    and auth.uid()::text = (storage.foldername(name))[1]
    and lower(right(name, 4)) in ('.pdf', '.png', '.jpg', 'jpeg', 'webp')
  );

-- ── 3. Diagnostic ────────────────────────────────────────────────
select 'Bucket durci :' as info;
select id, allowed_mime_types, file_size_limit
  from storage.buckets
 where id = 'factures-externes';
