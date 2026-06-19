-- =============================================================================
-- Coach AI — Report progressi AI (artefatto draft → approve).
--
-- Tabella `progress_reports`: l'AI analizza allenamenti loggati + check-in di un
-- cliente e produce una BOZZA di report (status='draft') che il coach revisiona
-- e approva. Stesso ciclo di vita degli altri artefatti (artifact_status) e
-- stesso isolamento multi-tenant (FK composite + RLS).
--
-- Invarianti rispettati (CLAUDE.md):
--  - ogni riga porta tenant_id; FK composite (tenant_id, client_id) -> clients.
--  - human-in-the-loop: nasce 'draft', mai auto-approvato.
--  - il CLIENTE potrà vedere SOLO i report 'published' (policy pronta); per ora
--    il report resta lato coach (nessuna UI cliente). Le bozze non sono mai
--    leggibili dal cliente.
--
-- Applicare nel SQL Editor del Dashboard del progetto reale tgjpolghmkskilplbhxa,
-- DOPO le migrazioni precedenti.
-- =============================================================================

create table if not exists public.progress_reports (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  client_id        uuid not null,
  status           public.artifact_status not null default 'draft',
  period_start     timestamptz,
  period_end       timestamptz,
  content          jsonb not null default '{}'::jsonb,
  generated_by_ai  boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  approved_at      timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists progress_reports_tenant_id_idx on public.progress_reports (tenant_id);
create index if not exists progress_reports_client_id_idx on public.progress_reports (client_id);

-- updated_at automatico (stessa funzione delle altre tabelle).
drop trigger if exists set_updated_at on public.progress_reports;
create trigger set_updated_at
  before update on public.progress_reports
  for each row execute function public.set_updated_at();

-- Grant di tabella (i grant "on all tables" della migrazione RLS valgono solo per
-- le tabelle ESISTENTI a quel momento: una tabella nuova va concessa a parte).
grant select, insert, update, delete on public.progress_reports to authenticated;
grant all on public.progress_reports to service_role;

-- -----------------------------------------------------------------------------
-- RLS — staff CRUD nel proprio tenant; il cliente vede SOLO i 'published'.
-- -----------------------------------------------------------------------------
alter table public.progress_reports enable row level security;

drop policy if exists staff_all on public.progress_reports;
create policy staff_all on public.progress_reports
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.is_staff()))
  with check (tenant_id = (select public.current_tenant_id()) and (select public.is_staff()));

drop policy if exists progress_reports_client_select on public.progress_reports;
create policy progress_reports_client_select on public.progress_reports
  for select to authenticated
  using (
    tenant_id = (select public.current_tenant_id())
    and status = 'published'
    and public.is_my_client(client_id)
  );
