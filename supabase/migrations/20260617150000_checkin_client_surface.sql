-- =============================================================================
-- Coach AI — Superficie CLIENTE per i check-in.
--
-- La tabella `checkins` resta solo-staff in RLS (per non esporre mai `ai_summary`
-- né `summary_status` al cliente). Esponiamo al cliente SOLO ciò che gli serve
-- tramite due funzioni SECURITY DEFINER che agiscono unicamente sui PROPRI
-- check-in (via my_client_id, già definita in 20260617130000_client_logging.sql):
--   * client_list_checkins()        -> i suoi check-in, SENZA la sintesi AI
--   * client_answer_checkin(id, jsonb) -> risponde a un proprio check-in
--
-- Applicare nel SQL Editor del Dashboard del progetto reale tgjpolghmkskilplbhxa.
-- =============================================================================

-- Elenco dei check-in del cliente corrente. Espone prompt/stato/risposta ma MAI
-- ai_summary/summary_status (campi interni al coach).
create or replace function public.client_list_checkins()
returns table (
  id            uuid,
  prompt        text,
  status        text,
  scheduled_for timestamptz,
  responded_at  timestamptz,
  response      jsonb,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.prompt, c.status, c.scheduled_for, c.responded_at,
         c.response, c.created_at
  from public.checkins c
  where c.client_id = public.my_client_id()
  order by c.created_at desc
$$;

-- Il cliente risponde a un PROPRIO check-in ancora aperto. Timbra responded_at
-- e porta lo stato ad 'answered'. Sicura: opera solo sul proprio client_id.
create or replace function public.client_answer_checkin(
  p_checkin_id uuid,
  p_response   jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := public.my_client_id();
begin
  if v_client is null then
    raise exception 'Nessun cliente collegato a questo account.';
  end if;

  update public.checkins
    set response = p_response,
        responded_at = now(),
        status = 'answered'
    where id = p_checkin_id
      and client_id = v_client
      and status in ('scheduled', 'sent');

  if not found then
    raise exception 'Check-in non trovato o non più rispondibile.';
  end if;
end;
$$;

grant execute on function public.client_list_checkins() to authenticated;
grant execute on function public.client_answer_checkin(uuid, jsonb) to authenticated;
