-- =============================================================================
-- Coach AI — Migrazione: token d'invito per l'anamnesi self-service.
--
-- Aggiunge a `clients` un token d'invito (univoco) + scadenza. Serve al flusso
-- /onboarding/[token]: lega l'anamnesi compilata da un lead (senza account) al
-- cliente giusto, SENZA esporre la tabella clients al browser. La risoluzione
-- del token avviene SOLO lato server con la chiave di servizio (service role).
--
-- RLS: nessuna nuova policy. Il coach (staff) scrive il token via la policy
-- `staff_all` esistente; il lead non legge mai clients (passa dal server).
--
-- Applicare nel SQL Editor del Dashboard del progetto reale tgjpolghmkskilplbhxa.
-- =============================================================================
alter table public.clients
  add column if not exists intake_token text,
  add column if not exists intake_token_expires_at timestamptz;

-- Univocità del token (i NULL multipli restano ammessi).
create unique index if not exists clients_intake_token_key
  on public.clients (intake_token)
  where intake_token is not null;
