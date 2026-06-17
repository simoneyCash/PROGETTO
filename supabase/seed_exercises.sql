-- =============================================================================
-- Coach AI — Libreria esercizi di base per il tenant del coach.
-- L'AI userà SOLO questi esercizi come grounding per generare le schede.
-- Metti la TUA email (quella del coach) in v_email e lancia nello SQL Editor.
-- Rieseguibile (on conflict per (tenant_id, name)).
-- =============================================================================
do $$
declare
  v_email text := 'METTI_QUI_LA_TUA_EMAIL';   -- email del coach
  v_tenant_id uuid;
begin
  select p.tenant_id into v_tenant_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = v_email and p.role in ('coach','admin')
  limit 1;

  if v_tenant_id is null then
    raise exception 'Nessun coach con email %. Lancia prima seed_coach.sql.', v_email;
  end if;

  insert into public.exercises (tenant_id, name, category, muscle_group, equipment) values
    (v_tenant_id, 'Squat con bilanciere', 'forza', 'gambe',     'bilanciere'),
    (v_tenant_id, 'Stacco da terra',      'forza', 'schiena',   'bilanciere'),
    (v_tenant_id, 'Panca piana',          'forza', 'petto',     'bilanciere'),
    (v_tenant_id, 'Military press',       'forza', 'spalle',    'bilanciere'),
    (v_tenant_id, 'Rematore con bilanciere','forza','schiena',  'bilanciere'),
    (v_tenant_id, 'Trazioni alla sbarra', 'forza', 'schiena',   'corpo libero'),
    (v_tenant_id, 'Dip alle parallele',   'forza', 'petto',     'corpo libero'),
    (v_tenant_id, 'Affondi con manubri',  'forza', 'gambe',     'manubri'),
    (v_tenant_id, 'Leg press',            'forza', 'gambe',     'macchina'),
    (v_tenant_id, 'Leg curl',             'forza', 'gambe',     'macchina'),
    (v_tenant_id, 'Lat machine',          'forza', 'schiena',   'macchina'),
    (v_tenant_id, 'Curl con manubri',     'forza', 'bicipiti',  'manubri'),
    (v_tenant_id, 'Push down ai cavi',    'forza', 'tricipiti', 'cavi'),
    (v_tenant_id, 'Alzate laterali',      'forza', 'spalle',    'manubri'),
    (v_tenant_id, 'Plank',                'core',  'addominali','corpo libero'),
    (v_tenant_id, 'Crunch',               'core',  'addominali','corpo libero'),
    (v_tenant_id, 'Camminata in pendenza','cardio','full body', 'tapis roulant')
  on conflict (tenant_id, name) do nothing;

  raise notice 'OK: libreria esercizi creata per il tenant %.', v_tenant_id;
end $$;
