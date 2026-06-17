-- =============================================================================
-- Coach AI — Test RLS (isolamento multi-tenant + human-in-the-loop)
-- Da eseguire DOPO aver applicato le due migrazioni.
-- È SICURO: lavora dentro transazioni che fanno ROLLBACK, non lascia dati.
-- Incollalo nello SQL Editor di Supabase. Se vedi i NOTICE "OK: ..." e nessun
-- errore, isolamento e invarianti funzionano.
--
-- Come funziona: si finge di essere coach/cliente impostando il `sub` del JWT
-- (`request.jwt.claims`) e passando al ruolo `authenticated`, soggetto alla RLS
-- (a differenza di `postgres`, proprietario delle tabelle). Gli helper RLS
-- risolvono tenant/ruolo da `profiles`, quindi servono utenti di prova reali.
--
-- NOTA: il test crea utenti in auth.users. Se la tua versione di Supabase
-- rifiuta l'INSERT in auth.users, crea gli utenti dal Dashboard (Authentication)
-- e sostituisci gli UUID qui sotto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TEST 1 — Isolamento tra tenant + WITH CHECK + deny-by-default
-- -----------------------------------------------------------------------------
begin;

insert into public.tenants (id, name) values
  ('0000000a-0000-0000-0000-00000000000a', 'Tenant A'),
  ('0000000b-0000-0000-0000-00000000000b', 'Tenant B');

-- Due coach reali (auth.users + profiles)
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000aa',
   'authenticated', 'authenticated', 'coach.a@example.com'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000bb',
   'authenticated', 'authenticated', 'coach.b@example.com');

insert into public.profiles (id, tenant_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000aa', '0000000a-0000-0000-0000-00000000000a', 'coach', 'Coach A'),
  ('00000000-0000-0000-0000-0000000000bb', '0000000b-0000-0000-0000-00000000000b', 'coach', 'Coach B');

insert into public.clients (id, tenant_id, full_name) values
  ('c1a0000a-0000-0000-0000-00000000000a', '0000000a-0000-0000-0000-00000000000a', 'Cliente A'),
  ('c1b0000b-0000-0000-0000-00000000000b', '0000000b-0000-0000-0000-00000000000b', 'Cliente B');

insert into public.exercises (tenant_id, name) values
  ('0000000a-0000-0000-0000-00000000000a', 'Squat A'),
  ('0000000b-0000-0000-0000-00000000000b', 'Panca B');

-- Persona: COACH del Tenant A
set local request.jwt.claims to
  '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
set local role authenticated;

do $$
begin
  assert (select count(*) from public.clients) = 1,
    'ISOLAMENTO FALLITO: il coach A vede clienti di altri tenant';
  assert (select full_name from public.clients) = 'Cliente A',
    'Il coach A vede il cliente sbagliato';
  assert (select count(*) from public.exercises) = 1,
    'ISOLAMENTO FALLITO: il coach A vede esercizi di altri tenant';
  raise notice 'OK: il coach A vede SOLO i dati del Tenant A';
end $$;

-- WITH CHECK: il coach A non può scrivere nel Tenant B
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.clients (tenant_id, full_name)
    values ('0000000b-0000-0000-0000-00000000000b', 'Intruso');
  exception when others then blocked := true;
  end;
  assert blocked, 'WITH CHECK FALLITO: il coach A ha scritto nel Tenant B';
  raise notice 'OK: il coach A non può inserire dati nel Tenant B';
end $$;

reset role;

-- Persona: COACH del Tenant B
set local request.jwt.claims to
  '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
set local role authenticated;

do $$
begin
  assert (select count(*) from public.clients) = 1,
    'ISOLAMENTO FALLITO: il coach B vede clienti di altri tenant';
  assert (select full_name from public.clients) = 'Cliente B',
    'Il coach B vede il cliente sbagliato';
  raise notice 'OK: il coach B vede SOLO i dati del Tenant B';
end $$;

reset role;

-- Persona: utente autenticato SENZA profilo (deny-by-default)
set local request.jwt.claims to
  '{"sub":"00000000-0000-0000-0000-0000000000cc","role":"authenticated"}';
set local role authenticated;

do $$
begin
  assert (select count(*) from public.clients) = 0,
    'DENY-BY-DEFAULT FALLITO: un utente senza profilo vede dei dati';
  raise notice 'OK: un utente senza profilo non vede nulla';
end $$;

reset role;
rollback;

-- -----------------------------------------------------------------------------
-- TEST 2 — Invarianti human-in-the-loop lato CLIENTE:
--   (a) vede SOLO le versioni 'published' (non le bozze)
--   (b) NON vede i check-in (e quindi nemmeno la bozza di sintesi AI)
-- -----------------------------------------------------------------------------
begin;

insert into public.tenants (id, name)
  values ('0000000a-0000-0000-0000-00000000000a', 'Tenant A');

-- Utente cliente reale + profilo + scheda cliente collegata
insert into auth.users (instance_id, id, aud, role, email)
  values ('00000000-0000-0000-0000-000000000000',
          '00000000-0000-0000-0000-0000000000d1',
          'authenticated', 'authenticated', 'cliente.test@example.com');

insert into public.profiles (id, tenant_id, role, full_name)
  values ('00000000-0000-0000-0000-0000000000d1',
          '0000000a-0000-0000-0000-00000000000a', 'client', 'Cliente Test');

insert into public.clients (id, tenant_id, profile_id, full_name)
  values ('c1d0000a-0000-0000-0000-00000000000a',
          '0000000a-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-0000000000d1', 'Cliente Test');

insert into public.programs (id, tenant_id, client_id, title)
  values ('06a0000a-0000-0000-0000-00000000000a',
          '0000000a-0000-0000-0000-00000000000a',
          'c1d0000a-0000-0000-0000-00000000000a', 'Programma Test');

-- una versione DRAFT (non deve essere visibile) e una PUBLISHED (visibile)
insert into public.program_versions (tenant_id, program_id, client_id, version, status) values
  ('0000000a-0000-0000-0000-00000000000a', '06a0000a-0000-0000-0000-00000000000a',
   'c1d0000a-0000-0000-0000-00000000000a', 1, 'draft'),
  ('0000000a-0000-0000-0000-00000000000a', '06a0000a-0000-0000-0000-00000000000a',
   'c1d0000a-0000-0000-0000-00000000000a', 2, 'published');

-- un check-in con una bozza di sintesi AI (NON deve essere leggibile dal cliente)
insert into public.checkins (tenant_id, client_id, prompt, ai_summary, summary_status)
  values ('0000000a-0000-0000-0000-00000000000a', 'c1d0000a-0000-0000-0000-00000000000a',
          'Come è andata la settimana?', 'BOZZA AI riservata al coach', 'draft');

-- Persona: il CLIENTE
set local request.jwt.claims to
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
set local role authenticated;

do $$
begin
  assert (select count(*) from public.program_versions) = 1,
    'INVARIANTE FALLITA: il cliente vede versioni non pubblicate (bozze)';
  assert (select status from public.program_versions) = 'published',
    'INVARIANTE FALLITA: il cliente vede uno status diverso da published';
  raise notice 'OK: il cliente vede SOLO la versione published (non la bozza)';

  assert (select count(*) from public.checkins) = 0,
    'INVARIANTE FALLITA: il cliente legge i check-in (e la bozza ai_summary)';
  raise notice 'OK: il cliente non vede i check-in (ai_summary protetta)';
end $$;

reset role;
rollback;
