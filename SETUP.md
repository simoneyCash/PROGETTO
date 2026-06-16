# SETUP — Da zero a primo avvio

Guida pratica passo-passo. Segui nell'ordine. Dove vedi `comando` lo incolli nel terminale,
dentro questa cartella.

## 0. Installa una volta sola
- **Node.js** (versione LTS) → https://nodejs.org
- **Git** → https://git-scm.com
- **Claude Code** → segui le istruzioni ufficiali di installazione
- (consigliato) **VS Code** come editor → https://code.visualstudio.com

Verifica che Node ci sia:
```
node -v
```

## 1. Crea il progetto Supabase (lo fai tu)
1. Vai su https://supabase.com → accedi → **New project**.
2. **Region: EU (Frankfurt)**. Importante.
3. Scegli una password forte per il database e **salvala**.
4. A progetto creato, vai in **Project Settings → API** e segnati:
   - **Project URL**
   - **anon public key**
   - **service_role key** (segreta, non condividerla mai)
5. Incolla questi valori nel file `.env.local` (vedi passo 2).

## 2. Le chiavi (file .env.local)
Copia il file `.env.example` in un nuovo file chiamato `.env.local` e riempi i valori.
Questo file NON va mai su GitHub (è già escluso da `.gitignore`).

## 3. Avvia Claude Code in questa cartella
Apri il terminale in questa cartella ed esegui:
```
claude
```
Claude Code leggerà in automatico il file `CLAUDE.md`: lì dentro c'è tutto il contesto,
lo stack bloccato e l'MVP. Non serve rispiegarglielo.

## 4. Primo prompt da dare a Claude Code (copia-incolla)
> Leggi CLAUDE.md. Inizializza il progetto: crea un'app Next.js (App Router, TypeScript,
> Tailwind) configurata come PWA, mobile-first e dark-mode-first. Aggiungi il client
> Supabase e leggi le variabili da .env.local. NON costruire ancora funzionalità:
> voglio solo lo scheletro che parte con `npm run dev` e una home vuota che dice "Coach AI".
> Quando hai finito, dimmi esattamente come avviarlo.

## 5. Secondo prompt (dopo che lo scheletro parte)
> Ora crea le migrazioni SQL iniziali per il modello dati descritto in CLAUDE.md,
> con `tenant_id` su ogni tabella e le policy RLS multi-tenant. Includi l'enum
> `artifact_status`. Spiegami come applicarle su Supabase.

## Ordine di costruzione (la fetta MVP, una cosa alla volta)
1. Login e ruoli (admin / coach / cliente)
2. Area coach: crea un cliente + questionario intake
3. Generazione AI della bozza di scheda → revisione e approvazione del coach
4. Portale cliente (PWA): vede la scheda e logga gli allenamenti
5. Check-in automatici → riepilogo AI → approvazione coach

Non passare al punto successivo finché il precedente non funziona davvero.
