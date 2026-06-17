-- =============================================================================
-- Coach AI — Logging allenamenti lato CLIENTE.
--
-- Problema: workout_logs richiede una `session_id`, ma il cliente non ha il
-- permesso di creare `sessions` (RLS: solo lettura). Soluzione: due funzioni
-- SECURITY DEFINER che agiscono SOLO sul record cliente del chiamante.
-- =============================================================================

-- my_client_id(): l'id del record `clients` dell'account cliente corrente (o
-- null se l'utente non è un cliente collegato). Utile anche per funzioni future.
create or replace function public.my_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.clients c
  where c.profile_id = (select auth.uid())
  limit 1
$$;

-- client_log_workout(): il cliente registra un allenamento COMPLETATO.
-- Crea la sessione + i log in un'unica transazione. È sicura perché usa solo
-- il PROPRIO client_id (via my_client_id) e timbra il tenant dal record cliente:
-- un cliente non può loggare per un altro.
--
-- p_logs è un array JSON di oggetti:
--   { "exercise_name": "...", "set_number": 1, "reps": 8, "weight": 60, "notes": "" }
create or replace function public.client_log_workout(
  p_program_version_id uuid,
  p_title text,
  p_logs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id  uuid;
  v_tenant_id  uuid;
  v_session_id uuid;
  v_log        jsonb;
begin
  v_client_id := public.my_client_id();
  if v_client_id is null then
    raise exception 'Nessun cliente collegato a questo account.';
  end if;

  select tenant_id into v_tenant_id
  from public.clients where id = v_client_id;

  -- La versione di scheda deve essere pubblicata e del cliente; altrimenti
  -- non la colleghiamo (ma non blocchiamo il salvataggio del log).
  if p_program_version_id is not null then
    perform 1 from public.program_versions
      where id = p_program_version_id
        and client_id = v_client_id
        and status = 'published';
    if not found then
      p_program_version_id := null;
    end if;
  end if;

  insert into public.sessions
    (tenant_id, client_id, program_version_id, title, status, completed_at)
  values
    (v_tenant_id, v_client_id, p_program_version_id, p_title, 'completed', now())
  returning id into v_session_id;

  for v_log in select * from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb))
  loop
    insert into public.workout_logs
      (tenant_id, client_id, session_id, exercise_name, set_number, reps, weight, notes)
    values (
      v_tenant_id,
      v_client_id,
      v_session_id,
      v_log->>'exercise_name',
      nullif(v_log->>'set_number','')::int,
      nullif(v_log->>'reps','')::int,
      nullif(v_log->>'weight','')::numeric,
      nullif(v_log->>'notes','')
    );
  end loop;

  return v_session_id;
end;
$$;

grant execute on function public.my_client_id() to authenticated;
grant execute on function public.client_log_workout(uuid, text, jsonb) to authenticated;
