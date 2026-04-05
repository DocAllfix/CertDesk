-- =============================================================================
-- Migration 015 — SECURITY DEFINER fixes finali
-- CertDesk — Fix bug critico genera_numero_pratica + hardening REVOKE/GRANT
--
-- BUG CRITICO corretto:
-- genera_numero_pratica() NON aveva SECURITY DEFINER. Con RLS attiva, il trigger
-- esegue col ruolo dell'utente che fa INSERT. La subquery
--   SELECT MAX(...) FROM pratiche WHERE numero_pratica LIKE 'CERT-YYYY-%'
-- rispetta le RLS policy → un operatore vede solo le proprie pratiche →
-- progressivo calcolato su subset → collisione su numero_pratica UNIQUE.
--
-- Esempio concreto:
--   - Pratiche in DB: CERT-2026-0001..0050 (tutte visibili ad admin)
--   - Operatore X ha assegnate solo CERT-2026-0003 e CERT-2026-0008
--   - Operatore X crea nuova pratica → trigger legge MAX(3,8)=8 → progressivo=9
--   - Genera CERT-2026-0009 → COLLIDE con pratica esistente → UNIQUE violation
--
-- Fix: aggiungere SECURITY DEFINER per bypassare RLS nella funzione trigger.
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 1: genera_numero_pratica() → SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════════════

ALTER FUNCTION genera_numero_pratica() SECURITY DEFINER;

COMMENT ON FUNCTION genera_numero_pratica() IS
  'BEFORE INSERT trigger: genera CERT-YYYY-NNNN con advisory lock. '
  'SECURITY DEFINER obbligatorio per bypassare RLS nella SELECT MAX(...) — '
  'altrimenti un operatore calcolerebbe il progressivo sul suo subset visibile.';


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 2: REVOKE FROM PUBLIC sulle trigger function SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════════════
-- Le trigger function non vengono invocate direttamente dal client
-- (solo da trigger interni). Però, essendo SECURITY DEFINER, best-practice
-- è revocare EXECUTE da PUBLIC per difesa in profondità:
-- nessun ruolo può chiamarle out-of-band via SELECT/PERFORM.

REVOKE ALL ON FUNCTION genera_numero_pratica() FROM PUBLIC;
REVOKE ALL ON FUNCTION log_cambio_fase()       FROM PUBLIC;
REVOKE ALL ON FUNCTION on_pratica_completata() FROM PUBLIC;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 3: Verifica/applica REVOKE/GRANT su funzioni chiamate dal client
-- ═══════════════════════════════════════════════════════════════════════════
-- Idempotente: già fatte nelle migration precedenti, rieseguiamo per sicurezza.

REVOKE ALL ON FUNCTION get_user_role()                   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_user_role()               TO authenticated;

REVOKE ALL ON FUNCTION get_pratiche_scadenze(INT)        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_pratiche_scadenze(INT)    TO authenticated;

REVOKE ALL ON FUNCTION get_statistiche_dashboard(UUID)   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_statistiche_dashboard(UUID) TO authenticated;

REVOKE ALL ON FUNCTION crea_notifica(UUID, UUID, notifica_tipo, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION crea_notifica(UUID, UUID, notifica_tipo, TEXT, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 4: Hardening update_updated_at() e validate_fase_transition() /
--        protect_fase_flags()
-- ═══════════════════════════════════════════════════════════════════════════
-- Queste trigger function NON leggono da altre tabelle (solo OLD/NEW),
-- quindi NON richiedono SECURITY DEFINER. Manteniamo SECURITY INVOKER
-- (default) ma applichiamo comunque REVOKE FROM PUBLIC per difesa in profondità.

REVOKE ALL ON FUNCTION update_updated_at()           FROM PUBLIC;
REVOKE ALL ON FUNCTION validate_fase_transition()    FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_fase_flags()          FROM PUBLIC;
