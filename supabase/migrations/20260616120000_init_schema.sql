-- =============================================================================
-- Coach AI — Migrazione 1/2: SCHEMA
-- Modello dati di CLAUDE.md §5. Ogni tabella di dominio porta `tenant_id`.
-- La sicurezza (RLS) è nella migrazione 2 (..._init_rls.sql), da applicare DOPO.
--
-- Convenzioni:
--   * id          uuid, default gen_random_uuid()
--   * tenant_id   uuid NOT NULL -> tenants(id), ON DELETE CASCADE
--   * created_at / updated_at   timestamptz, default now()
--
-- Integrità multi-tenant: le tabelle figlie usano FK COMPOSITE (tenant_id, id)
-- verso clients/programs, così è impossibile agganciare una riga a un cliente
-- di un altro tenant (anche per lo staff).
--
-- Identificatori in inglese; commenti in italiano.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Enum
-- -----------------------------------------------------------------------------

-- Ruolo applicativo (NON il ruolo Postgres). Scoping per-tenant in `profiles`.
do $$ begin
  create type public.app_role as enum ('admin', 'coach', 'client');
exception when duplicate_object then null; end $$;

-- Ciclo di vita di OGNI artefatto AI (programmi, piani nutrizionali, ecc.).
-- Invariante "human-in-the-loop": nasce sempre `draft`, mai auto-pubblicato.
do $$ begin
  create type public.artifact_status as enum (
    'draft', 'pending_review', 'approved', 'published', 'archived'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 1. Funzione trigger: aggiorna updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Tabelle
-- -----------------------------------------------------------------------------

-- tenants — un record per coach/brand. È la radice dell'isolamento.
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- profiles — identità utente, legata ad auth.users, con ruolo nel tenant.
-- È la FONTE DI VERITÀ per tenant_id e role (vedi helper RLS sotto).
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        public.app_role not null default 'client',
  full_name   text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);

-- clients — anagrafica clienti gestita dal coach. `profile_id` collega
-- l'eventuale account del cliente (null per i lead senza account).
-- UNIQUE(tenant_id, id) serve come bersaglio delle FK composite dei figli.
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  coach_id    uuid references public.profiles(id) on delete set null,
  full_name   text not null,
  email       text,
  phone       text,
  status      text not null default 'lead',  -- lead | active | paused | churned
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id)
);
create index if not exists clients_tenant_id_idx  on public.clients (tenant_id);
create index if not exists clients_profile_id_idx on public.clients (profile_id);
create index if not exists clients_coach_id_idx   on public.clients (coach_id);

-- intakes — risposte al questionario, usate per innescare la generazione AI.
create table if not exists public.intakes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null,
  answers       jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists intakes_tenant_id_idx on public.intakes (tenant_id);
create index if not exists intakes_client_id_idx on public.intakes (client_id);

-- exercises — libreria esercizi per-tenant (fonte di grounding per l'AI).
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  category      text,
  muscle_group  text,
  equipment     text,
  video_url     text,
  instructions  text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, name)
);
create index if not exists exercises_tenant_id_idx on public.exercises (tenant_id);

-- programs — contenitore del programma di allenamento di un cliente.
-- UNIQUE(tenant_id, id) per le FK composite di program_versions.
create table if not exists public.programs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  client_id           uuid not null,
  title               text not null,
  description         text,
  current_version_id  uuid,  -- FK aggiunta sotto (dipendenza circolare)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists programs_tenant_id_idx on public.programs (tenant_id);
create index if not exists programs_client_id_idx on public.programs (client_id);

-- program_versions — versioni dell'artefatto, con artifact_status.
-- `client_id` denormalizzato dal program; le FK composite garantiscono che
-- program_id e client_id appartengano ENTRAMBI allo stesso tenant della riga.
create table if not exists public.program_versions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  program_id       uuid not null,
  client_id        uuid not null,
  version          integer not null default 1,
  status           public.artifact_status not null default 'draft',
  content          jsonb not null default '{}'::jsonb,
  generated_by_ai  boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  approved_at      timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (program_id, version),
  foreign key (tenant_id, client_id)  references public.clients  (tenant_id, id) on delete cascade,
  foreign key (tenant_id, program_id) references public.programs (tenant_id, id) on delete cascade
);
create index if not exists program_versions_tenant_id_idx  on public.program_versions (tenant_id);
create index if not exists program_versions_program_id_idx on public.program_versions (program_id);
create index if not exists program_versions_client_id_idx  on public.program_versions (client_id);

-- FK circolare: programs.current_version_id -> program_versions.id
do $$ begin
  alter table public.programs
    add constraint programs_current_version_id_fkey
    foreign key (current_version_id)
    references public.program_versions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- sessions — sessione di allenamento (pianificata e/o svolta).
create table if not exists public.sessions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  client_id            uuid not null,
  program_version_id   uuid references public.program_versions(id) on delete set null,
  title                text,
  scheduled_for        timestamptz,
  status               text not null default 'planned',  -- planned | completed | skipped
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists sessions_tenant_id_idx on public.sessions (tenant_id);
create index if not exists sessions_client_id_idx on public.sessions (client_id);

-- workout_logs — cosa ha fatto davvero il cliente (set/ripetizioni/carico).
create table if not exists public.workout_logs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  session_id     uuid not null references public.sessions(id) on delete cascade,
  client_id      uuid not null,
  exercise_id    uuid references public.exercises(id) on delete set null,
  exercise_name  text,        -- snapshot, sopravvive a modifiche della libreria
  set_number     integer,
  reps           integer,
  weight         numeric(6,2),
  rpe            numeric(3,1),
  notes          text,
  logged_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists workout_logs_tenant_id_idx  on public.workout_logs (tenant_id);
create index if not exists workout_logs_session_id_idx on public.workout_logs (session_id);
create index if not exists workout_logs_client_id_idx  on public.workout_logs (client_id);

-- checkins — prompt programmati e risposte del cliente. La sintesi AI
-- (`ai_summary`) è un artefatto: nasce draft e va approvata dal coach.
-- NB: in RLS la tabella è solo-staff; la superficie cliente (prompt+risposta,
-- SENZA ai_summary) verrà esposta con una view/RPC quando si costruirà il
-- modulo check-in.
create table if not exists public.checkins (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null,
  scheduled_for   timestamptz,
  prompt          text,
  status          text not null default 'scheduled',  -- scheduled | sent | answered | skipped
  response        jsonb,
  responded_at    timestamptz,
  ai_summary      text,
  summary_status  public.artifact_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists checkins_tenant_id_idx on public.checkins (tenant_id);
create index if not exists checkins_client_id_idx on public.checkins (client_id);

-- nutrition_plans — opzionale, stesso ciclo draft -> approve dei programmi.
create table if not exists public.nutrition_plans (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  client_id        uuid not null,
  title            text,
  status           public.artifact_status not null default 'draft',
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
create index if not exists nutrition_plans_tenant_id_idx on public.nutrition_plans (tenant_id);
create index if not exists nutrition_plans_client_id_idx on public.nutrition_plans (client_id);

-- messages — comunicazione coach/cliente (in-app). Append-only.
-- `sender_role` è timbrato da un trigger dal profilo reale del mittente:
-- il cliente NON può spacciarsi per coach.
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  client_id    uuid not null,
  sender_id    uuid references public.profiles(id) on delete set null,
  sender_role  public.app_role,
  body         text not null,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade
);
create index if not exists messages_tenant_id_idx on public.messages (tenant_id);
create index if not exists messages_client_id_idx on public.messages (client_id);

-- subscriptions — stato abbonamento Stripe (status come testo: Stripe ne
-- aggiunge di nuovi, evitiamo un enum rigido). client_id nullable.
create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  client_id               uuid,
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  status                  text,
  price_id                text,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Se il cliente viene cancellato, CONSERVA lo stato Stripe (audit/billing):
  -- azzera solo client_id, lascia intatto tenant_id. Sintassi colonna: PG15+.
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete set null (client_id)
);
create index if not exists subscriptions_tenant_id_idx on public.subscriptions (tenant_id);
create index if not exists subscriptions_client_id_idx on public.subscriptions (client_id);

-- payments — pagamenti Stripe. client_id nullable.
create table if not exists public.payments (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  client_id                 uuid,
  subscription_id           uuid references public.subscriptions(id) on delete set null,
  stripe_payment_intent_id  text unique,
  amount_cents              integer,
  currency                  text not null default 'eur',
  status                    text,
  paid_at                   timestamptz,
  created_at                timestamptz not null default now(),
  -- Conserva il pagamento se il cliente viene cancellato: azzera solo
  -- client_id (tenant_id è NOT NULL e va preservato). Sintassi colonna: PG15+.
  foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete set null (client_id)
);
create index if not exists payments_tenant_id_idx on public.payments (tenant_id);
create index if not exists payments_client_id_idx on public.payments (client_id);

-- activity_log — traccia di audit delle azioni importanti.
create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists activity_log_tenant_id_idx on public.activity_log (tenant_id);

-- -----------------------------------------------------------------------------
-- 3. Trigger updated_at (solo tabelle che hanno la colonna)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','profiles','clients','intakes','exercises','programs',
    'program_versions','sessions','workout_logs','checkins',
    'nutrition_plans','subscriptions'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Helper RLS — FONTE DI VERITÀ = tabella profiles.
--    SECURITY DEFINER: leggono profiles bypassando la RLS, quindi niente
--    ricorsione nelle policy. NESSUNA fiducia nei claim del JWT: così non c'è
--    rischio di "claim stantio" (es. coach spostato di tenant). Una eventuale
--    ottimizzazione con claim JWT andrà aggiunta solo CON un trigger che li
--    sincronizza da profiles e un controllo claim==profiles (rimandata).
-- -----------------------------------------------------------------------------

-- tenant_id dell'utente corrente.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.tenant_id from public.profiles p where p.id = (select auth.uid())
$$;

-- ruolo applicativo dell'utente corrente ('admin' | 'coach' | 'client').
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role::text from public.profiles p where p.id = (select auth.uid())
$$;

-- true se l'utente è staff del tenant (coach o admin).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('admin','coach'), false)
$$;

-- true se il client_id appartiene all'utente corrente (account cliente).
create or replace function public.is_my_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client_id
      and c.profile_id = (select auth.uid())
  )
$$;

-- -----------------------------------------------------------------------------
-- 5. Protezione colonne privilegiate di profiles
--    Un utente normale non può cambiare il proprio role/tenant_id (escalation).
--    Solo i ruoli di servizio (Edge Function con service_role) possono.
-- -----------------------------------------------------------------------------
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'supabase_admin', 'postgres') then
    if new.role is distinct from old.role then
      raise exception 'Operazione non consentita: modifica di role';
    end if;
    if new.tenant_id is distinct from old.tenant_id then
      raise exception 'Operazione non consentita: modifica di tenant_id';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- -----------------------------------------------------------------------------
-- 6. messages.sender_role timbrato dal profilo REALE del mittente.
--    Chiude lo spoofing: un cliente non può inviare un messaggio come 'coach'.
-- -----------------------------------------------------------------------------
create or replace function public.messages_stamp_sender_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_id is not null then
    -- ruolo dal profilo reale del mittente, MA solo se nello stesso tenant
    -- della riga (altrimenti resta null: niente mislabel cross-tenant).
    new.sender_role := (
      select p.role from public.profiles p
      where p.id = new.sender_id and p.tenant_id = new.tenant_id
    );
  else
    new.sender_role := null;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_stamp_sender_role on public.messages;
create trigger messages_stamp_sender_role
  before insert on public.messages
  for each row execute function public.messages_stamp_sender_role();
