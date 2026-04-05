# cron-scadenze — Edge Function

Edge Function Supabase schedulata per CertDesk.
Eseguita ogni giorno alle **07:00 UTC** (08:00 ora di Roma, estate; 08:00 invernale).

---

## Responsabilità

### Parte A — Safety net promemoria orfani
Trova le pratiche completate (`completata = true`) che non hanno ancora il reminder di
sorveglianza (`sorveglianza_reminder_creato = false`) e lo crea in recovery.

Questo copre edge case dove il trigger DB `on_pratica_completata` non è stato eseguito
(es. migrazione dati da vecchio sistema, aggiornamenti manuali via SQL, bug storici).

Logica scadenza identica al trigger:
- SA 8000 → **+1095 giorni** (36 mesi)
- Tutte le altre norme → **+365 giorni** (12 mesi)

### Parte B — Notifiche escalation scadenze (5 livelli)

| Soglia | Tipo | Destinatari |
|--------|------|-------------|
| 60 giorni | `info` | `assegnato_a` (o admin se mancante) |
| 30 giorni | `warning` | `assegnato_a` (o admin se mancante) |
| 14 giorni | `critical` | `assegnato_a` (o admin se mancante) |
| 7 giorni  | `critical` | `assegnato_a` (o admin se mancante) |
| 1 giorno  | `critical` | `assegnato_a` (o admin se mancante) |
| Scaduta   | `critical` | Tutti gli admin + `assegnato_a` |

Le notifiche vengono tracciate in `notifiche_scadenza_inviate(pratica_id, giorni_soglia)`.
Non vengono mai ri-inviate per la stessa pratica+soglia.

### Parte C — Promemoria scaduti
Trova i promemoria (`data_scadenza <= oggi`, `completato = false`) e invia una notifica
`warning` al destinatario (`assegnato_a`). Deduplicata ogni 23 ore per promemoria.

---

## Configurazione soglie (personalizzazione)

Le soglie sono definite in `index.ts`:

```typescript
const SOGLIE_ESCALATION = [60, 30, 14, 7, 1] as const
```

I titoli delle notifiche sono in `SOGLIA_CONFIG`. Modificare qui per ogni cliente.

---

## Scheduling (Dashboard Supabase)

1. Aprire **Supabase Dashboard → Edge Functions**
2. Selezionare `cron-scadenze`
3. Cliccare su **Cron** (tab o sezione laterale)
4. Aggiungere un nuovo schedule:
   - **Cron expression:** `0 7 * * *`
   - **HTTP Method:** `POST`
   - **Timezone:** UTC
5. Salvare

> **Nota:** il cron Supabase è disponibile sui piani Pro e superiori.
> Per il piano gratuito, usare un servizio esterno (GitHub Actions, cron-job.org)
> che chiami `POST https://<project-ref>.supabase.co/functions/v1/cron-scadenze`
> con header `Authorization: Bearer <ANON_KEY>` e `--no-verify-jwt` abilitato sulla funzione.

---

## Invocazione manuale (test)

```bash
# Dal terminale, nella directory certdesk/
supabase functions invoke cron-scadenze --no-verify-jwt
```

Oppure via curl (sostituire `<project-ref>` e `<SERVICE_ROLE_KEY>`):

```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/cron-scadenze \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

La risposta è un JSON con il riepilogo dell'esecuzione:

```json
{
  "parteA": { "trovati": 0, "creati": 0, "errori": 0 },
  "parteB": { "pratiche": 12, "notifiche_inviate": 3, "errori": 0 },
  "parteC": { "promemoria_scaduti": 2, "notifiche_inviate": 2, "errori": 0 },
  "eseguito_at": "2026-04-05T07:00:00.000Z"
}
```

---

## Deploy

```bash
# Prima volta (deploy)
supabase functions deploy cron-scadenze

# Aggiornamento
supabase functions deploy cron-scadenze
```

---

## Sicurezza

- La funzione usa `SUPABASE_SERVICE_ROLE_KEY` — **mai esposta al frontend**.
- Il service_role bypassa le RLS per leggere tutte le pratiche di tutti gli utenti
  e inserire notifiche senza un `auth.uid()` attivo. Questo è il comportamento
  atteso per un job schedulato lato server.
- La tabella `notifiche_scadenza_inviate` è accessibile in lettura solo agli admin
  (RLS policy "Admin lettura escalation inviate" — migration 012).

---

## Log

I log della funzione sono visibili in **Supabase Dashboard → Edge Functions → cron-scadenze → Logs**.

Ogni esecuzione logga:
- `[ParteA]` — pratiche orfane trovate e promemoria creati
- `[ParteB]` — pratiche controllate e notifiche inviate per soglia
- `[ParteC]` — promemoria scaduti trovati e notifiche inviate
- `[cron-scadenze] Completato:` — riepilogo finale JSON
