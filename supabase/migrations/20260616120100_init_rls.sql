-- =============================================================================
-- Coach AI — Migrazione 2/2: RLS (Row-Level Security)
-- Da applicare DOPO ..._init_schema.sql.
--
-- Principio guida (CLAUDE.md §2.2): l'isolamento tra tenant è nel database.
--   * Confine NON negoziabile: ogni policy filtra `tenant_id = current_tenant_id()`.
--   * Staff (coach/admin): CRUD completo SOLO dentro il proprio tenant.
--   * Cliente: legge i propri dati; degli artefatti AI vede SOLO i `published`.
--   * service_role (Edge Function) ha BYPASSRLS: onboarding, webhook Stripe,
--     scritture AI e audit avvengono lato server, mai dal browser.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Grant di base (l'accesso vero è deciso dalle policy qui sotto)
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. Abilita RLS su OGNI tabella (default: nega tutto finché non c'è una policy)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','profiles','clients','intakes','exercises','programs',
    'program_versions','sessions','workout_logs','checkins',
    'nutrition_plans','messages','subscriptions','payments','activity_log'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Policy "staff_all": CRUD completo per coach/admin nel proprio tenant.
--    Applicata in modo identico a tutte le tabelle operative.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clients','intakes','exercises','programs','program_versions','sessions',
    'workout_logs','checkins','nutrition_plans','messages','subscriptions','payments'
  ]
  loop
    execute format('drop policy if exists staff_all on public.%I;', t);
    execute format(
      'create policy staff_all on public.%I
         for all to authenticated
         using (tenant_id = (select public.current_tenant_id()) and (select public.is_staff()))
         with check (tenant_id = (select public.current_tenant_id()) and (select public.is_staff()));',
      t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 3. tenants — ogni membro legge il proprio tenant; lo staff può aggiornarlo.
-- -----------------------------------------------------------------------------
drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member on public.tenants
  for select to authenticated
  using (id = (select public.current_tenant_id()));

drop policy if exists tenants_update_staff on public.tenants;
create policy tenants_update_staff on public.tenants
  for update to authenticated
  using (id = (select public.current_tenant_id()) and (select public.is_staff()))
  with check (id = (select public.current_tenant_id()) and (select public.is_staff()));

-- -----------------------------------------------------------------------------
-- 4. profiles — lettura nel tenant; ognuno aggiorna SOLO il proprio profilo.
--    (role/tenant_id sono protetti dal trigger profiles_guard.)
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_tenant on public.profiles;
create policy profiles_select_tenant on public.profiles
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 5. clients — tabella SOLO staff (gestita da staff_all).
--    Volutamente nessuna policy per il cliente: la `clients` contiene anche le
--    note private del coach. Il cliente accede ai propri dati nelle tabelle
--    figlie tramite la funzione public.is_my_client(), che legge `clients` in
--    SECURITY DEFINER senza esporne le colonne.
-- -----------------------------------------------------------------------------
-- (nessuna policy clients_* per il ruolo cliente)

-- -----------------------------------------------------------------------------
-- 6. intakes — il cliente compila/vede il proprio questionario.
-- -----------------------------------------------------------------------------
drop policy if exists intakes_client_select on public.intakes;
create policy intakes_client_select on public.intakes
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

drop policy if exists intakes_client_insert on public.intakes;
create policy intakes_client_insert on public.intakes
  for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

-- Il cliente può modificare l'intake SOLO prima di averlo inviato
-- (submitted_at is null). Dopo l'invio è il coach/Edge Function a gestirlo:
-- così non si riscrive la base su cui l'AI e il coach hanno già lavorato.
drop policy if exists intakes_client_update on public.intakes;
create policy intakes_client_update on public.intakes
  for update to authenticated
  using (
    tenant_id = (select public.current_tenant_id())
    and public.is_my_client(client_id)
    and submitted_at is null
  )
  with check (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

-- -----------------------------------------------------------------------------
-- 7. exercises — il cliente legge la libreria del tenant (vede gli esercizi
--    citati nella propria scheda).
-- -----------------------------------------------------------------------------
drop policy if exists exercises_client_select on public.exercises;
create policy exercises_client_select on public.exercises
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.current_app_role()) = 'client');

-- -----------------------------------------------------------------------------
-- 8. programs — il cliente vede il contenitore SOLO se esiste una versione
--    pubblicata (niente bozze in mano al cliente).
-- -----------------------------------------------------------------------------
drop policy if exists programs_client_select on public.programs;
create policy programs_client_select on public.programs
  for select to authenticated
  using (
    tenant_id = (select public.current_tenant_id())
    and public.is_my_client(client_id)
    and exists (
      select 1 from public.program_versions v
      where v.program_id = programs.id and v.status = 'published'
    )
  );

-- -----------------------------------------------------------------------------
-- 9. program_versions — INVARIANTE: il cliente vede SOLO le versioni 'published'.
-- -----------------------------------------------------------------------------
drop policy if exists program_versions_client_select on public.program_versions;
create policy program_versions_client_select on public.program_versions
  for select to authenticated
  using (
    tenant_id = (select public.current_tenant_id())
    and status = 'published'
    and public.is_my_client(client_id)
  );

-- -----------------------------------------------------------------------------
-- 10. sessions — il cliente vede le proprie sessioni.
-- -----------------------------------------------------------------------------
drop policy if exists sessions_client_select on public.sessions;
create policy sessions_client_select on public.sessions
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

-- -----------------------------------------------------------------------------
-- 11. workout_logs — il cliente registra e rivede i propri allenamenti.
-- -----------------------------------------------------------------------------
drop policy if exists workout_logs_client_select on public.workout_logs;
create policy workout_logs_client_select on public.workout_logs
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

drop policy if exists workout_logs_client_insert on public.workout_logs;
create policy workout_logs_client_insert on public.workout_logs
  for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

drop policy if exists workout_logs_client_update on public.workout_logs;
create policy workout_logs_client_update on public.workout_logs
  for update to authenticated
  using (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id))
  with check (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

-- -----------------------------------------------------------------------------
-- 12. checkins — SOLO staff (gestita da staff_all). Nessuna policy cliente.
--     Motivo: la riga contiene `ai_summary`/`summary_status`, una bozza AI.
--     La RLS è per-riga, NON per-colonna: dare al cliente il SELECT sulla riga
--     gli farebbe leggere la sintesi AI ancora non approvata -> violazione di
--     human-in-the-loop. La superficie cliente del check-in (prompt + risposta,
--     SENZA ai_summary) verrà esposta con una view/RPC dedicata quando si
--     costruirà il modulo check-in.
-- -----------------------------------------------------------------------------
drop policy if exists checkins_client_select on public.checkins;
-- (nessuna policy checkins_* per il ruolo cliente)

-- -----------------------------------------------------------------------------
-- 13. nutrition_plans — INVARIANTE: il cliente vede SOLO i piani 'published'.
-- -----------------------------------------------------------------------------
drop policy if exists nutrition_plans_client_select on public.nutrition_plans;
create policy nutrition_plans_client_select on public.nutrition_plans
  for select to authenticated
  using (
    tenant_id = (select public.current_tenant_id())
    and status = 'published'
    and public.is_my_client(client_id)
  );

-- -----------------------------------------------------------------------------
-- 14. messages — il cliente legge il proprio thread e può inviare messaggi.
-- -----------------------------------------------------------------------------
drop policy if exists messages_client_select on public.messages;
create policy messages_client_select on public.messages
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

drop policy if exists messages_client_insert on public.messages;
create policy messages_client_insert on public.messages
  for insert to authenticated
  with check (
    tenant_id = (select public.current_tenant_id())
    and public.is_my_client(client_id)
    and sender_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 15. subscriptions / payments — il cliente vede i propri (sola lettura).
-- -----------------------------------------------------------------------------
drop policy if exists subscriptions_client_select on public.subscriptions;
create policy subscriptions_client_select on public.subscriptions
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

drop policy if exists payments_client_select on public.payments;
create policy payments_client_select on public.payments
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and public.is_my_client(client_id));

-- -----------------------------------------------------------------------------
-- 16. activity_log — solo staff, in lettura e inserimento (mai modifica/cancella).
-- -----------------------------------------------------------------------------
drop policy if exists activity_log_staff_select on public.activity_log;
create policy activity_log_staff_select on public.activity_log
  for select to authenticated
  using (tenant_id = (select public.current_tenant_id()) and (select public.is_staff()));

drop policy if exists activity_log_staff_insert on public.activity_log;
create policy activity_log_staff_insert on public.activity_log
  for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id()) and (select public.is_staff()));
