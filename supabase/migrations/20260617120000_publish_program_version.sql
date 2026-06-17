-- =============================================================================
-- Coach AI — Migrazione 3: RPC publish_program_version
-- Pubblicazione ATOMICA di una versione di scheda (human-in-the-loop).
-- Da applicare DOPO le prime due migrazioni.
--
-- SECURITY INVOKER: gira come l'utente -> la RLS (staff_all) garantisce che
-- un coach possa pubblicare SOLO versioni del proprio tenant. Tutto in una
-- transazione: o va a buon fine tutto, o niente.
-- =============================================================================
create or replace function public.publish_program_version(p_version_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_program_id uuid;
begin
  -- 1) pubblica la versione (solo da uno stato lecito)
  update public.program_versions
     set status       = 'published',
         approved_at  = coalesce(approved_at, now()),
         published_at = now(),
         reviewed_by  = (select auth.uid())
   where id = p_version_id
     and status in ('draft', 'pending_review', 'approved')
   returning program_id into v_program_id;

  if v_program_id is null then
    raise exception 'Versione non pubblicabile (inesistente, di un altro tenant, o già pubblicata/archiviata)';
  end if;

  -- 2) una sola versione "corrente": archivia le altre già pubblicate
  update public.program_versions
     set status = 'archived'
   where program_id = v_program_id
     and id <> p_version_id
     and status = 'published';

  -- 3) punta il programma alla versione pubblicata
  update public.programs
     set current_version_id = p_version_id
   where id = v_program_id;

  return v_program_id;
end;
$$;

grant execute on function public.publish_program_version(uuid) to authenticated;
