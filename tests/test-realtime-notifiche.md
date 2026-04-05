# Test Real-time e Notifiche — F8

> Questi test richiedono **almeno 2 utenti attivi** nel sistema.
> Da eseguire dopo aver creato il secondo utente su Supabase Dashboard.

---

## Setup utente di test

1. Supabase Dashboard → Authentication → Users → **Invite user** (email secondaria)
2. Table Editor → `user_profiles` → compila: `nome`, `cognome`, `ruolo` (es. `operatore`), `attivo = true`
3. Assegna il secondo utente ad almeno una pratica come `assegnato_a` (serve per RLS messaggi)

---

## Test 1 — Real-time messaggi (2 tab, stesso utente)

**Prerequisito:** nessuno (funziona anche con 1 solo utente)

1. Apri la stessa pratica in **due tab** del browser
2. Dalla tab A invia un messaggio qualsiasi
3. **Atteso:** il messaggio appare nella tab B entro 1-2 secondi **senza refresh**
4. Se appare solo dopo refresh → Realtime non funziona (controllare publication `supabase_realtime`)

---

## Test 2 — Notifica real-time alla campanellina (2 utenti)

**Prerequisito:** 2 utenti attivi, entrambi assegnati alla stessa pratica

1. Utente A (admin) loggato nel browser normale
2. Utente B loggato in una **finestra privata/incognito**
3. Utente A invia una **Richiesta** con destinatario = Utente B
4. **Atteso:** la campanellina di Utente B si aggiorna in tempo reale (senza refresh) con notifica tipo `richiesta`

---

## Test 3 — Richiesta broadcast a "Tutti" (2 utenti)

**Prerequisito:** 2+ utenti attivi

1. Utente A invia una **Richiesta** con destinatario = **Tutti**
2. **Atteso:** notifica tipo `richiesta` arriva a tutti gli utenti attivi tranne il mittente
3. Verifica in Supabase → Table Editor → `notifiche` → filtra per `created_at` recente

---

## Test 4 — Commento broadcast (2 utenti)

1. Utente A invia un **Commento** con destinatario = **Tutti**
2. **Atteso:** notifica tipo `info` arriva a tutti gli altri utenti attivi
3. Verifica sulla campanellina di Utente B in tempo reale

---

## Test 5 — Risposta a utente specifico (2 utenti)

1. Utente A invia una **Risposta** con destinatario = Utente B
2. **Atteso:** notifica tipo `info` con titolo "Nuova risposta" arriva a Utente B

---

## Verifica rapida DB (da Supabase CLI)

```sql
-- Ultime notifiche create
SELECT tipo, titolo, destinatario_id, mittente_id, created_at
FROM notifiche
ORDER BY created_at DESC
LIMIT 10;

-- Tabelle nella publication Realtime (devono esserci entrambe)
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

---

## Note

- Con 1 solo utente admin: i test 2-5 non producono notifiche (comportamento corretto — non si notifica se stessi)
- Il paperclip nel composer messaggi è placeholder: allegati nel feed non implementati in F8
- Polling fallback notifiche: se WebSocket cade, le notifiche arrivano comunque entro 60s (vedere `useNotifiche.ts`)
