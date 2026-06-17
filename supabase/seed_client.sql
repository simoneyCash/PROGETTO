-- =============================================================================
-- Coach AI — Aggancio di un ACCOUNT CLIENTE a un record `clients` esistente.
--
-- Perché serve: la tabella `clients` contiene anche note private del coach,
-- quindi il cliente non può scriverci dall'app. L'aggancio (creare il profilo
-- 'client' e impostare clients.profile_id) si fa una volta da qui, come per il
-- coach. Niente Edge Function.
--
-- PRIMA (nell'area Coach): crea il cliente in /coach/clienti mettendo la SUA
--   email, e pubblica almeno una scheda per lui (così avrà qualcosa da vedere).
--
-- PASSO 1 (dal Dashboard): Authentication -> Users -> "Add user".
--   Inserisci la STESSA email del cliente e una password. Spunta "Auto Confirm User".
-- PASSO 2 (qui): metti la STESSA email in v_email qui sotto e lancia questo
--   script nello SQL Editor. Rieseguibile senza danni.
-- =============================================================================
do $$
declare
  v_email     text := 'METTI_QUI_EMAIL_CLIENTE';  -- <-- email del cliente (= PASSO 1)
  v_user_id   uuid;
  v_client_id uuid;
  v_tenant_id uuid;
  v_name      text;
  v_n         int;
begin
  -- Utente auth (creato al PASSO 1)
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception
      'Nessun utente auth con email %. Crealo prima dal Dashboard (Authentication -> Add user) con "Auto Confirm User".',
      v_email;
  end if;

  -- Record cliente corrispondente (creato dal coach con la stessa email)
  select count(*) into v_n from public.clients where email = v_email;
  if v_n = 0 then
    raise exception
      'Nessun cliente con email % nell''area Coach. Crealo prima in /coach/clienti con questa email.',
      v_email;
  elsif v_n > 1 then
    raise exception
      'Ci sono % clienti con email %. Rendile univoche prima di agganciare.',
      v_n, v_email;
  end if;

  select id, tenant_id, full_name
    into v_client_id, v_tenant_id, v_name
    from public.clients
    where email = v_email;

  -- Profilo 'client' collegato all'utente auth, nello STESSO tenant del cliente
  insert into public.profiles (id, tenant_id, role, full_name, email)
  values (v_user_id, v_tenant_id, 'client', v_name, v_email)
  on conflict (id) do update
    set role = 'client',
        tenant_id = excluded.tenant_id,
        full_name = excluded.full_name,
        email = excluded.email;

  -- Aggancio: il record cliente punta al profilo dell'account
  update public.clients set profile_id = v_user_id where id = v_client_id;

  raise notice 'OK: account % agganciato al cliente % (tenant %).',
    v_email, v_client_id, v_tenant_id;
end $$;
