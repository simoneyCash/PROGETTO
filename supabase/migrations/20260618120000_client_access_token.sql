-- =============================================================================
-- Coach AI — Token di ATTIVAZIONE account cliente (Onda 3A: accesso senza SQL).
--
-- Sostituisce il flusso manuale `seed_client.sql` (creare l'utente auth nel
-- Dashboard + lanciare SQL). Ora il coach genera un link `/attiva/[token]`: il
-- cliente apre il link, sceglie la password e l'account viene creato + collegato
-- (profilo 'client' nel tenant giusto + clients.profile_id) lato server con la
-- chiave di servizio. Stesso modello di sicurezza del token anamnesi.
--
-- RLS: nessuna nuova policy. Il coach (staff) scrive il token via la policy
-- `staff_all` esistente; il cliente non legge mai `clients` (passa dal server).
--
-- Applicare nel SQL Editor del Dashboard del progetto reale tgjpolghmkskilplbhxa.
-- =============================================================================
alter table public.clients
  add column if not exists access_token text,
  add column if not exists access_token_expires_at timestamptz;

-- Univocità del token (i NULL multipli restano ammessi).
create unique index if not exists clients_access_token_key
  on public.clients (access_token)
  where access_token is not null;
