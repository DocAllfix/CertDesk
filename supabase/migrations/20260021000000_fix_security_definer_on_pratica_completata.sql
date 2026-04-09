-- =============================================================================
-- Migration 021 — Ripristina SECURITY DEFINER su on_pratica_completata()
-- CertDesk — Fix regressione introdotta da migration 019 e 020
--
-- PROBLEMA (identico a migration 016):
-- Migration 016 aveva ripristinato SECURITY DEFINER su on_pratica_completata().
-- Migration 019 (data_prossima_sorveglianza) e 020 (audit_integrati) hanno
-- riemesso la funzione con CREATE OR REPLACE senza ridichiarare SECURITY
-- DEFINER, resettando nuovamente l'attributo a SECURITY INVOKER (default PG).
--
-- IMPATTO:
-- Il trigger BEFORE UPDATE on pratiche esegue INSERT INTO promemoria quando
-- la pratica passa a fase=completata. Con SECURITY INVOKER, l'INSERT gira
-- con i permessi dell'utente corrente. La RLS policy promemoria_insert
-- richiede creato_da = auth.uid() OR get_user_role() = 'admin'.
-- Il trigger passa COALESCE(NEW.updated_by, NEW.created_by) come creato_da.
-- Se l'utente che completa (auth.uid()) non è admin e non coincide con
-- updated_by/created_by della pratica → INSERT rifiutato → UPDATE rollback
-- → impossibile completare pratiche assegnate ad altri utenti.
--
-- FIX:
-- ALTER FUNCTION (non CREATE OR REPLACE) → modifica SOLO l'attributo di
-- sicurezza, senza toccare il corpo della funzione.
-- Identico pattern già usato con successo in migration 016.
-- Idempotente: rieseguire non causa errori.
-- =============================================================================

ALTER FUNCTION on_pratica_completata() SECURITY DEFINER;

-- Hardening: nessun accesso diretto dalla role PUBLIC
REVOKE ALL ON FUNCTION on_pratica_completata() FROM PUBLIC;

COMMENT ON FUNCTION on_pratica_completata() IS
  'BEFORE UPDATE OF fase trigger: crea promemoria sorveglianza a +N giorni dal '
  'completamento (N=36 mesi per SA 8000, 12 mesi altrimenti). '
  'Popola data_prossima_sorveglianza sulla pratica. '
  'Arricchisce il testo con riferimento audit integrato se applicabile. '
  'SECURITY DEFINER obbligatorio per bypassare RLS policy promemoria_insert '
  'quando l''utente che completa la pratica differisce dal creato_da del promemoria. '
  'Regressione fixata: migration 019 e 020 avevano resettato l''attributo con '
  'CREATE OR REPLACE (stessa regressione di migration 012, fixata in 016).';
