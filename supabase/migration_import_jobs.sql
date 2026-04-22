-- ============================================================
-- RestoPilot — Jobs d'import asynchrones (Edge Function)
--
-- Stratégie : la route API Next.js ne fait que déposer le PDF et
-- créer un job ; la Supabase Edge Function (Deno, sans limite de
-- timeout Netlify) traite le document et met à jour la ligne.
--
-- Le client poll /api/releve-status/[job_id] pour voir l'avancement.
-- ============================================================

create table if not exists import_jobs (
  id               uuid primary key default gen_random_uuid(),
  restaurateur_id  uuid not null references auth.users(id) on delete cascade,
  type             text not null check (type in ('releve','facture','mercuriale')),
  status           text not null default 'pending' check (status in ('pending','processing','done','error')),
  pdf_path         text,                -- chemin dans storage.releves
  source_filename  text,
  page_count       smallint,
  result           jsonb,               -- payload final (lignes, solde…)
  error_message    text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists import_jobs_resto_idx on import_jobs(restaurateur_id, created_at desc);
create index if not exists import_jobs_status_idx on import_jobs(status) where status in ('pending','processing');

alter table import_jobs enable row level security;

drop policy if exists import_jobs_scope on import_jobs;
create policy import_jobs_scope on import_jobs for all
  using (restaurateur_id = auth.uid() or is_admin())
  with check (restaurateur_id = auth.uid() or is_admin());

drop trigger if exists import_jobs_updated_at on import_jobs;
create trigger import_jobs_updated_at before update on import_jobs
  for each row execute function set_updated_at();

-- ── Storage : bucket "releves" (privé) ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('releves', 'releves', false)
on conflict (id) do nothing;

-- Lecture : le propriétaire (préfixe = restaurateur_id) ou l'admin
drop policy if exists releves_own_read on storage.objects;
create policy releves_own_read on storage.objects for select
  using (
    bucket_id = 'releves'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_admin())
  );

-- Écriture : uniquement le propriétaire (le service_role bypass RLS
-- côté Edge Function de toute façon)
drop policy if exists releves_own_write on storage.objects;
create policy releves_own_write on storage.objects for insert
  with check (
    bucket_id = 'releves'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists releves_own_delete on storage.objects;
create policy releves_own_delete on storage.objects for delete
  using (
    bucket_id = 'releves'
    and (auth.uid()::text = (storage.foldername(name))[1] or is_admin())
  );

-- ── Diagnostic ─────────────────────────────────────────────────────
select 'Table import_jobs créée :' as info;
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='import_jobs' order by ordinal_position;

select 'Policies import_jobs :' as info;
select policyname, cmd from pg_policies where tablename='import_jobs';

select 'Bucket releves :' as info;
select id, name, public from storage.buckets where id='releves';
