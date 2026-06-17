-- =============================================================================
-- Coach AI — Seed del PRIMO coach (coach pilota) + il suo tenant.
--
-- Serve perché il database è vuoto: senza un profilo 'coach' non puoi entrare.
--
-- PASSO 1 (dal Dashboard): Authentication -> Users -> "Add user".
--   Inserisci la TUA email e una password. Spunta "Auto Confirm User".
-- PASSO 2 (qui): metti la STESSA email in v_email qui sotto e lancia questo
--   script nello SQL Editor. Rieseguibile senza danni.
-- =============================================================================
do $$
declare
  v_email text := 'METTI_QUI_LA_TUA_EMAIL';   -- <-- la stessa email del PASSO 1
  v_name  text := 'Coach';                     -- <-- (opzionale) nome mostrato
  v_user_id uuid;
  v_tenant_id uuid;
  v_slug text;
begin
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception
      'Nessun utente auth con email %. Crealo prima dal Dashboard (Authentication -> Add user) con "Auto Confirm User".',
      v_email;
  end if;

  v_slug := 'tenant-' || left(replace(v_user_id::text, '-', ''), 8);

  -- tenant del coach (idempotente sullo slug)
  insert into public.tenants (name, slug)
  values (v_name || ' — tenant', v_slug)
  on conflict (slug) do update set name = excluded.name
  returning id into v_tenant_id;

  -- profilo coach collegato all'utente auth
  insert into public.profiles (id, tenant_id, role, full_name, email)
  values (v_user_id, v_tenant_id, 'coach', v_name, v_email)
  on conflict (id) do update
    set role = 'coach',
        tenant_id = excluded.tenant_id,
        full_name = excluded.full_name,
        email = excluded.email;

  raise notice 'OK: coach % collegato al tenant % (%).', v_email, v_name, v_tenant_id;
end $$;
