-- =============================================================================
-- Migration 016 — Ripristina SECURITY DEFINER su on_pratica_completata()
-- CertDesk — Fix regressione introdotta da migration 012
--
-- PROBLEMA:
-- Migration 008 aveva applicato ALTER FUNCTION on_pratica_completata() SECURITY DEFINER.
-- Migration 012 (sa8000_prep_escalation) ha fatto CREATE OR REPLACE FUNCTION
-- on_pratica_completata() senza ridichiarare SECURITY DEFINER, quindi
-- l'attributo è stato RESETTATO a SECURITY INVOKER (default).
--
-- IMPATTO:
-- Il trigger esegue INSERT INTO promemoria quando una pratica passa a completata.
-- Con SECURITY INVOKER, l'INSERT gira con i permessi dell'utente che ha fatto
-- l'UPDATE. La policy promemoria_insert richiede creato_da = auth.uid() OR admin.
-- Il trigger passa COALESCE(NEW.updated_by, NEW.created_by) come creato_da:
-- se questo NON coincide con auth.uid() (es. admin completa una pratica di altri
-- via interfaccia), la RLS rifiuta l'INSERT → tutto l'UPDATE rolled back →
-- impossibile completare pratiche di terzi.
--
-- FIX:
-- ALTER FUNCTION ... SECURITY DEFINER ripristina il comportamento atteso.
-- =============================================================================

ALTER FUNCTION on_pratica_completata() SECURITY DEFINER;

-- Hardening: REVOKE coerente con le altre trigger function
REVOKE ALL ON FUNCTION on_pratica_completata() FROM PUBLIC;

COMMENT ON FUNCTION on_pratica_completata() IS
  'BEFORE UPDATE OF fase trigger: crea promemoria sorveglianza a +N giorni dal '
  'completamento (N=36 mesi per SA8000, 12 mesi altrimenti). '
  'SECURITY DEFINER obbligatorio per bypassare RLS policy promemoria_insert '
  'quando l''utente che completa la pratica differisce dal creato_da del promemoria. '
  'Regressione fixata: migration 012 aveva resettato l''attributo con CREATE OR REPLACE.';
