# CertDesk — Script di Test Funzionale

> **Versione:** 1.0
> **Data:** 2026-04-06
> **Utenti di test:** 4 (admin, responsabile, operatore-A, operatore-B)

---

## Utenti di Riferimento

| Ruolo | Nome | UUID | Email |
|-------|------|------|-------|
| Admin | — | `293bb2e0-ca30-41ca-83aa-c75c95dafa40` | (dashboard Supabase) |
| Responsabile | — | `52230bff-385c-48d1-add3-9b15e60a1e93` | (dashboard Supabase) |
| Operatore-A | — | `8e199ba7-4913-4fda-a10d-6a025ca84c16` | (dashboard Supabase) |
| Operatore-B | — | `bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4` | (dashboard Supabase) |

> **Nota:** 4 utenti sono sufficienti per tutti i 5 scenari. I due operatori coprono i test RLS (vede solo le proprie pratiche).

---

## Prerequisiti

1. App in esecuzione (`npm run dev`)
2. Supabase project attivo con migration applicate
3. Dati seed caricati (`tests/test-data-seed.sql`)
4. Almeno 2 browser/profili per test real-time (Scenario 3)

---

## SCENARIO 1 — Flusso Completo Pratica (End-to-End)

**Obiettivo:** Verificare l'intero ciclo di vita di una pratica dalla creazione al completamento, inclusi tutti i trigger DB.

**Login come:** Admin

### 1.1 — Creazione Cliente

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Vai a Database > Clienti > "Nuovo Cliente" | Modal creazione si apre | ☐ |
| 2 | Compila: Nome="Test Srl", P.IVA="12345678901", Codice EA="EA 29", N. Dipendenti="50", Email="test@testsrl.it" | Tutti i campi accettano i valori | ☐ |
| 3 | Clicca "Crea Cliente" | Cliente creato, modal si chiude, toast successo | ☐ |
| 4 | Verifica il cliente nella lista | "Test Srl" visibile con codice EA e dipendenti | ☐ |

### 1.2 — Creazione Consulente

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Vai a Database > Consulenti > "Nuovo Consulente" | Modal creazione si apre | ☐ |
| 2 | Compila: Nome="Mario", Cognome="Rossi", Email="m.rossi@studio.it" | Campi compilati | ☐ |
| 3 | Norme gestite: seleziona "ISO 9001" | Tag ISO 9001 visibile | ☐ |
| 4 | Clicca "Nuovo Consulente" | Consulente creato, norme salvate | ☐ |

### 1.3 — Creazione Pratica

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Vai a Pratiche > "Nuova Pratica" | Form creazione pratica | ☐ |
| 2 | Seleziona cliente "Test Srl" | Cliente associato | ☐ |
| 3 | Seleziona norma "ISO 9001" | Norma visibile nel multi-select | ☐ |
| 4 | Ciclo: "Certificazione" | Selezionato | ☐ |
| 5 | Assegnato a: Operatore-A | Operatore selezionato | ☐ |
| 6 | Consulente: "Mario Rossi" | Consulente selezionato | ☐ |
| 7 | Compila referente, note, data scadenza | Tutti i campi accettati | ☐ |
| 8 | Salva pratica | Pratica creata in fase "Contratto Firmato" | ☐ |
| 9 | **Verifica numero pratica** | Formato `CERT-2026-NNNN` generato dal trigger `set_numero_pratica` | ☐ |

### 1.4 — Test FK Norme (Integrità Referenziale)

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Da Supabase SQL Editor, esegui: `INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES ('<pratica_id>', 'ISO 99999');` | **ERRORE:** FK violation — `norme_catalogo` non contiene "ISO 99999" | ☐ |

### 1.5 — Verifica Notifica Operatore

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Login come Operatore-A | Dashboard operatore | ☐ |
| 2 | Controlla icona notifiche (campanella) | Notifica: nuova pratica assegnata | ☐ |

### 1.6 — Avanzamento Fase 1 → 2 (senza data verifica = ERRORE)

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Login come Admin, apri la pratica appena creata | Dettaglio pratica in fase "Contratto Firmato" | ☐ |
| 2 | Clicca "Avanza a Programmazione Verifica" | Modal avanzamento si apre | ☐ |
| 3 | Conferma avanzamento | Avanzamento OK (nessun prerequisito per fase 2) | ☐ |

### 1.7 — Avanzamento Fase 2 → 3 (SENZA data verifica = ERRORE)

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | La pratica e ora in "Programmazione Verifica" | Fase 2 attiva | ☐ |
| 2 | Tenta avanzamento a "Richiesta Proforma" | Modal mostra prerequisito rosso: "Data verifica non ancora impostata" | ☐ |
| 3 | Bottone "Avanza" disabilitato (pre-validazione UI) | Impossibile cliccare | ☐ |
| 4 | **Test trigger DB diretto** — da SQL Editor: `UPDATE pratiche SET fase = 'richiesta_proforma' WHERE id = '<pratica_id>';` | **ERRORE DB:** `Data verifica obbligatoria per avanzare a Richiesta Proforma` | ☐ |

### 1.8 — Impostazione Data Verifica + Avanzamento

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Nel modal avanzamento, usa input data inline per impostare data verifica | Data salvata (inline save) | ☐ |
| 2 | Prerequisito diventa verde (check icon) | UI aggiornata | ☐ |
| 3 | Conferma avanzamento a "Richiesta Proforma" | Pratica avanza a fase 3 | ☐ |
| 4 | Verifica notifica all'auditor (se impostato) | Notifica inviata | ☐ |

### 1.9 — Proforma Emessa + Avanzamento Fase 3 → 4

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | La pratica e in "Richiesta Proforma" | Fase 3 attiva | ☐ |
| 2 | Tenta avanzamento a "Elaborazione Pratica" | Prerequisito rosso: "Proforma non ancora emessa" | ☐ |
| 3 | Clicca "Segna come emessa" nel modal | Flag proforma_emessa = true | ☐ |
| 4 | Prerequisito diventa verde | Check verde | ☐ |
| 5 | Conferma avanzamento | Pratica avanza a fase 4 "Elaborazione Pratica" | ☐ |
| 6 | **Verifica notifica admin** (responsabile amministrazione) | Notifica ricevuta | ☐ |

### 1.10 — Fase 4: Blocco Documenti Mancanti

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | La pratica e in "Elaborazione Pratica" con documenti_ricevuti=false | Fase 4, blocco attivo | ☐ |
| 2 | **Alert rosso prominente** visibile nel dettaglio | "Documenti mancanti — in attesa di ricezione" | ☐ |
| 3 | Tenta avanzamento a "Firme" | Prerequisito rosso: "Documenti devono essere ricevuti" | ☐ |
| 4 | Bottone avanzamento disabilitato | Impossibile procedere | ☐ |

### 1.11 — Documenti Ricevuti + Sblocco

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Clicca "Segna come ricevuti" nel modal avanzamento | Flag documenti_ricevuti = true | ☐ |
| 2 | Alert rosso scompare | UI sbloccata | ☐ |
| 3 | Notifica success al responsabile pratica | Notifica "Documenti ricevuti" | ☐ |
| 4 | Conferma avanzamento a "Firme" | Pratica avanza a fase 5 | ☐ |
| 5 | **Notifica a tutti gli utenti coinvolti** | Notifica fase "Firme" | ☐ |

### 1.12 — Completamento Pratica

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | La pratica e in fase "Firme" | Fase 5 attiva | ☐ |
| 2 | Clicca "Avanza a Completata", conferma | Pratica completata | ☐ |
| 3 | **Verifica campo `completata`** (SQL): `SELECT completata, completata_at FROM pratiche WHERE id = '...';` | `completata = true`, `completata_at` impostato (trigger `validate_fase_transition` L101-105) | ☐ |
| 4 | **Verifica promemoria sorveglianza** (SQL): `SELECT * FROM promemoria WHERE pratica_id = '...';` | Promemoria creato con `data_scadenza = completata_at + 365 giorni` (trigger `on_pratica_completata`) | ☐ |
| 5 | **Verifica flag** (SQL): `SELECT sorveglianza_reminder_creato FROM pratiche WHERE id = '...';` | `sorveglianza_reminder_creato = true` | ☐ |
| 6 | Verifica notifica success ad admin + assegnato_a | Notifiche ricevute | ☐ |

### 1.13 — Verifica Storico Fasi

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | SQL: `SELECT * FROM storico_fasi WHERE pratica_id = '...' ORDER BY created_at;` | 5 righe: CF→PV, PV→RP, RP→EP, EP→F, F→C con timestamp e cambiato_da | ☐ |

---

## SCENARIO 2 — Permessi Ruoli (RLS)

**Obiettivo:** Verificare che le RLS policies isolino correttamente i dati per ruolo.

### 2.1 — Visibilita Operatore

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Login come Operatore-A | Dashboard operatore | ☐ |
| 2 | Vai a Pratiche | Vede SOLO le pratiche con `assegnato_a = Operatore-A` | ☐ |
| 3 | Verifica che pratiche assegnate ad altri NON compaiano | Lista filtrata correttamente | ☐ |

### 2.2 — Modifica Pratica Non Propria (RLS Block)

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Login come Operatore-A | — | ☐ |
| 2 | Da SQL Editor (come Operatore-A via API): `UPDATE pratiche SET note = 'hack' WHERE assegnato_a != '<operatore_a_id>';` | **0 righe aggiornate** — RLS blocca silenziosamente | ☐ |
| 3 | Tentare di accedere via URL diretto al dettaglio di una pratica non assegnata | Dati non caricati / errore / redirect | ☐ |

### 2.3 — Salto Fasi (Trigger Block)

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Login come Operatore-A | — | ☐ |
| 2 | SQL: `UPDATE pratiche SET fase = 'firme' WHERE id = '<pratica_in_fase_1>' AND assegnato_a = '<operatore_a_id>';` | **ERRORE DB:** `Non e possibile saltare fasi: da contratto_firmato a firme` | ☐ |
| 3 | SQL: `UPDATE pratiche SET fase = 'contratto_firmato' WHERE id = '<pratica_in_fase_4>';` | **ERRORE DB:** `Retrocessione massima di una fase` (se salta >1) | ☐ |

### 2.4 — Operatore Non Puo Creare Per Altri

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Login come Operatore-A, crea nuova pratica | Pratica creata con `assegnato_a = Operatore-A` (RLS forza) | ☐ |
| 2 | SQL: `INSERT INTO pratiche (..., assegnato_a) VALUES (..., '<operatore_b_id>');` eseguito come Operatore-A | **ERRORE RLS:** policy INSERT richiede `assegnato_a = auth.uid()` per operatore | ☐ |

### 2.5 — Admin e Responsabile Vedono Tutto

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Login come Admin | Vede TUTTE le pratiche | ☐ |
| 2 | Login come Responsabile | Vede TUTTE le pratiche | ☐ |
| 3 | Entrambi possono modificare qualsiasi pratica | Update va a buon fine | ☐ |

---

## SCENARIO 3 — Notifiche Real-time

**Obiettivo:** Verificare che le notifiche arrivino in tempo reale via Supabase Realtime.

**Setup:** Aprire 2 browser (o 2 profili browser) contemporaneamente.

### 3.1 — Messaggio Interno Real-time

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Browser 1: Login come Admin | Dashboard admin | ☐ |
| 2 | Browser 2: Login come Operatore-A | Dashboard operatore | ☐ |
| 3 | Browser 1: Apri una pratica assegnata a Operatore-A | Dettaglio pratica | ☐ |
| 4 | Browser 1: Invia messaggio tipo "Richiesta" destinatario Operatore-A | Messaggio inviato | ☐ |
| 5 | Browser 2: **Senza refresh** — controlla campanella notifiche | Badge notifica incrementato, notifica visibile in real-time | ☐ |
| 6 | Browser 2: Apri il pannello notifiche | Messaggio dell'admin visibile | ☐ |

### 3.2 — Notifica Cambio Fase Real-time

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Browser 1 (Admin): Avanza una pratica di fase | Cambio fase eseguito | ☐ |
| 2 | Browser 2 (Operatore): **Senza refresh** — notifica appare | Notifica cambio fase visibile in tempo reale | ☐ |

### 3.3 — Reconnect Dopo Disconnessione

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Browser 2 (Operatore): Disconnetti WiFi/rete per ~10 secondi | Connessione persa | ☐ |
| 2 | Riconnetti WiFi/rete | — | ☐ |
| 3 | Browser 1 (Admin): Invia un messaggio durante o dopo la disconnessione | Messaggio inviato | ☐ |
| 4 | Browser 2: Verifica che la notifica appaia dopo riconnessione | Supabase Realtime riconnette e recupera gli eventi | ☐ |

---

## SCENARIO 4 — Upload Allegati

**Obiettivo:** Verificare upload, download e sicurezza dei file allegati.

**Login come:** Admin

### 4.1 — Upload File

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Apri una pratica qualsiasi | Dettaglio pratica | ☐ |
| 2 | Sezione "Allegati" > Carica un PDF di test (<50MB) | Upload in corso, progress visibile | ☐ |
| 3 | Upload completato | File visibile nella lista allegati con nome, dimensione, data | ☐ |
| 4 | Record in DB: `SELECT * FROM allegati WHERE pratica_id = '...';` | Riga presente con `storage_path`, `nome_file`, `dimensione`, `mime_type` | ☐ |

### 4.2 — Download e Integrita

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Clicca sul file per scaricarlo | Download inizia | ☐ |
| 2 | Apri il file scaricato | File identico all'originale, non corrotto | ☐ |
| 3 | **Verifica signed URL:** il link di download contiene un token temporaneo | URL contiene parametro `token=...` | ☐ |

### 4.3 — Scadenza Signed URL (5 minuti)

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Copia l'URL di download del file | URL copiato | ☐ |
| 2 | Attendi 6 minuti | — | ☐ |
| 3 | Incolla l'URL in una nuova scheda | **ERRORE 400/403** — signed URL scaduto (SIGNED_URL_EXPIRY = 300s) | ☐ |
| 4 | Torna all'app e riscarica | Nuovo signed URL generato, download funziona | ☐ |

### 4.4 — Limite Dimensione File

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Tentare upload di un file > 50MB | Toast errore: "Il file supera il limite di 50 MB" | ☐ |
| 2 | File NON caricato | Nessun record in `allegati` | ☐ |

### 4.5 — Tipi File Accettati

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Upload `.pdf`, `.docx`, `.xlsx`, `.jpg`, `.png` | Tutti accettati | ☐ |
| 2 | Upload `.exe`, `.bat`, `.sh` | File non selezionabile (filtro `accept` nel file input) | ☐ |

---

## SCENARIO 5 — Sospensione e Annullamento

**Obiettivo:** Verificare che il trigger DB blocchi le operazioni su pratiche non attive.

**Login come:** Admin

### 5.1 — Sospensione Pratica

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Apri una pratica attiva (non completata) | Dettaglio pratica | ☐ |
| 2 | Cambia stato a "Sospesa" | Stato aggiornato a `sospesa` | ☐ |
| 3 | Tenta avanzamento fase | **ERRORE:** bottone disabilitato (pre-validazione UI: `stato !== 'attiva'`) | ☐ |
| 4 | **Test trigger DB diretto:** `UPDATE pratiche SET fase = 'programmazione_verifica' WHERE id = '...' AND stato = 'sospesa';` | **ERRORE DB:** `Impossibile cambiare fase: la pratica e in stato sospesa` (trigger L64-66) | ☐ |

### 5.2 — Riattivazione Pratica

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Cambia stato da "Sospesa" a "Attiva" | Stato torna a `attiva` | ☐ |
| 2 | Tenta avanzamento fase | Avanzamento funziona normalmente | ☐ |

### 5.3 — Annullamento Pratica

| # | Azione | Risultato atteso | OK |
|---|--------|------------------|----|
| 1 | Apri una pratica attiva diversa | Dettaglio pratica | ☐ |
| 2 | Cambia stato a "Annullata" (con motivo) | Stato aggiornato a `annullata` | ☐ |
| 3 | Tenta avanzamento fase | **ERRORE:** bloccato sia da UI che da trigger DB | ☐ |
| 4 | La pratica appare nell'archivio/lista con stato "Annullata" | Visibile con badge stato | ☐ |

---

## Riepilogo Risultati

| Scenario | Test | Passati | Falliti | Note |
|----------|------|---------|---------|------|
| 1 — Flusso Completo | 13 sezioni, ~30 check | /30 | /30 | |
| 2 — Permessi Ruoli | 5 sezioni, ~12 check | /12 | /12 | |
| 3 — Notifiche Real-time | 3 sezioni, ~10 check | /10 | /10 | |
| 4 — Upload Allegati | 5 sezioni, ~12 check | /12 | /12 | |
| 5 — Sospensione/Annullamento | 3 sezioni, ~8 check | /8 | /8 | |
| **TOTALE** | | **/72** | **/72** | |

---

## Note per il Tester

1. **Trigger DB:** I test contrassegnati con "Test trigger DB diretto" richiedono accesso al SQL Editor di Supabase per verificare che la protezione sia server-side e non solo UI.
2. **RLS:** Per testare le RLS come un utente specifico, usare il JWT dell'utente nelle chiamate API o loggarsi dall'app.
3. **Notifiche:** Le notifiche sono INTERNE al gestionale — nessuna email viene inviata.
4. **Signed URL:** La scadenza di 5 minuti e configurata in `src/lib/storage/allegati.ts` (SIGNED_URL_EXPIRY = 300).
5. **Dati seed:** Eseguire `tests/test-data-seed.sql` per avere dati realistici su cui lavorare.
