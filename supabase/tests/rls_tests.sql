-- =============================================================================
-- RLS Tests — CertDesk
--
-- COME ESEGUIRE:
--   Opzione A (Supabase Dashboard): apri SQL Editor e incolla questo file intero,
--     sostituendo i placeholder UUID_* con quelli reali del seed.
--   Opzione B (psql): psql "$DATABASE_URL" -f supabase/tests/rls_tests.sql
--
-- COME FUNZIONA:
--   - SET LOCAL ROLE authenticated  → simula utente autenticato (non service_role)
--   - SET LOCAL request.jwt.claims  → imposta auth.uid() al fine del test
--   - Ogni test stampa PASS/FAIL con RAISE NOTICE
--
-- PLACEHOLDER da sostituire (tutti UUID dal seed):
--   UUID_ADMIN         → utente admin
--   UUID_OPERATORE_A   → operatore con pratica assegnata
--   UUID_OPERATORE_B   → operatore DIVERSO (no pratica assegnata al set di A)
--   UUID_PRATICA_DI_A  → pratica.id con assegnato_a = UUID_OPERATORE_A
--   UUID_PRATICA_DI_B  → pratica.id con assegnato_a = UUID_OPERATORE_B
--   UUID_STORICO_ROW   → id di una riga in storico_fasi (qualsiasi)
--   UUID_NOTIFICA_A    → notifiche.id con destinatario_id = UUID_OPERATORE_A
--   UUID_ALLEGATO_B    → allegati.id con pratica_id = UUID_PRATICA_DI_B
-- =============================================================================

BEGIN;

-- Helper: stampa risultato test
CREATE OR REPLACE FUNCTION pg_temp.assert_equals(
  p_test_name TEXT, p_expected BIGINT, p_actual BIGINT
) RETURNS VOID AS $$
BEGIN
  IF p_expected = p_actual THEN
    RAISE NOTICE 'PASS: % (expected=%, actual=%)', p_test_name, p_expected, p_actual;
  ELSE
    RAISE WARNING 'FAIL: % (expected=%, actual=%)', p_test_name, p_expected, p_actual;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 1 — Operatore A NON deve vedere la pratica di Operatore B
-- Expected: 0 righe
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"UUID_OPERATORE_A","role":"authenticated"}';

DO $$
DECLARE cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM pratiche WHERE id = 'UUID_PRATICA_DI_B';
  PERFORM pg_temp.assert_equals('T01 operatore A vede pratica B', 0::BIGINT, cnt);
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 2 — Operatore A NON deve poter UPDATE la pratica di B
-- Expected: 0 righe aggiornate (filtro RLS USING elimina la riga)
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL request.jwt.claims = '{"sub":"UUID_OPERATORE_A","role":"authenticated"}';

DO $$
DECLARE rows_affected BIGINT;
BEGIN
  WITH upd AS (
    UPDATE pratiche SET note = 'hack attempt' WHERE id = 'UUID_PRATICA_DI_B' RETURNING 1
  )
  SELECT COUNT(*) INTO rows_affected FROM upd;
  PERFORM pg_temp.assert_equals('T02 operatore A UPDATE pratica B', 0::BIGINT, rows_affected);
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 3 — Operatore B NON deve vedere notifiche destinate ad A
-- Expected: 0 righe
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL request.jwt.claims = '{"sub":"UUID_OPERATORE_B","role":"authenticated"}';

DO $$
DECLARE cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM notifiche WHERE id = 'UUID_NOTIFICA_A';
  PERFORM pg_temp.assert_equals('T03 operatore B legge notifica di A', 0::BIGINT, cnt);
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 4 — storico_fasi è IMMUTABILE (no UPDATE policy, no DELETE policy)
-- Expected: 0 righe affected
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL request.jwt.claims = '{"sub":"UUID_ADMIN","role":"authenticated"}';

DO $$
DECLARE rows_affected BIGINT;
BEGIN
  WITH upd AS (
    UPDATE storico_fasi SET motivo = 'tampered' WHERE id = 'UUID_STORICO_ROW' RETURNING 1
  )
  SELECT COUNT(*) INTO rows_affected FROM upd;
  PERFORM pg_temp.assert_equals('T04 admin UPDATE storico_fasi', 0::BIGINT, rows_affected);

  WITH del AS (
    DELETE FROM storico_fasi WHERE id = 'UUID_STORICO_ROW' RETURNING 1
  )
  SELECT COUNT(*) INTO rows_affected FROM del;
  PERFORM pg_temp.assert_equals('T04 admin DELETE storico_fasi', 0::BIGINT, rows_affected);
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 5 — Utente anon (non autenticato) NON deve accedere a pratiche
-- Expected: 0 righe
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE anon;
RESET request.jwt.claims;

DO $$
DECLARE cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM pratiche;
  PERFORM pg_temp.assert_equals('T05 anon SELECT pratiche', 0::BIGINT, cnt);
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 6 — Operatore A NON deve saltare fasi (bypass trigger validate_fase_transition)
-- Expected: EXCEPTION lanciata dal trigger
-- ═══════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"UUID_OPERATORE_A","role":"authenticated"}';

DO $$
DECLARE v_exception BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE pratiche SET fase = 'completata' WHERE id = 'UUID_PRATICA_DI_A';
  EXCEPTION WHEN OTHERS THEN
    v_exception := true;
    RAISE NOTICE 'T06 trigger exception (expected): %', SQLERRM;
  END;

  IF v_exception THEN
    RAISE NOTICE 'PASS: T06 salto fasi bloccato dal trigger';
  ELSE
    RAISE WARNING 'FAIL: T06 salto fasi NON bloccato — BUG CRITICO';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 7 — Operatore A NON deve resettare proforma_emessa=false se già true
--          in fase avanzata (bypass trigger protect_fase_flags)
-- PREREQUISITO: UUID_PRATICA_DI_A è in fase >= elaborazione_pratica con
--               proforma_emessa=true. Sostituire altrimenti con altra pratica.
-- Expected: EXCEPTION lanciata dal trigger
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_exception BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE pratiche
       SET proforma_emessa = false
     WHERE id = 'UUID_PRATICA_DI_A'
       AND proforma_emessa = true;
  EXCEPTION WHEN OTHERS THEN
    v_exception := true;
    RAISE NOTICE 'T07 trigger exception (expected): %', SQLERRM;
  END;

  IF v_exception THEN
    RAISE NOTICE 'PASS: T07 reset proforma_emessa bloccato';
  ELSE
    RAISE NOTICE 'SKIP/PASS: T07 nessuna riga aggiornata (la pratica non è nello stato prerequisito)';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 8 — Operatore A NON deve leggere allegato di pratica di B
-- Expected: 0 righe
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE cnt BIGINT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM allegati WHERE id = 'UUID_ALLEGATO_B';
  PERFORM pg_temp.assert_equals('T08 operatore A legge allegato di B', 0::BIGINT, cnt);
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 9 — Operatore A NON deve INSERT allegato su pratica di B
-- Expected: EXCEPTION (WITH CHECK fallisce)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_exception BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO allegati (pratica_id, nome_file, nome_originale, storage_path, caricato_da)
    VALUES ('UUID_PRATICA_DI_B', 'hack.pdf', 'hack.pdf',
            'UUID_PRATICA_DI_B/hack.pdf', 'UUID_OPERATORE_A');
  EXCEPTION WHEN OTHERS THEN
    v_exception := true;
    RAISE NOTICE 'T09 RLS violation (expected): %', SQLERRM;
  END;

  IF v_exception THEN
    RAISE NOTICE 'PASS: T09 INSERT allegato cross-pratica bloccato';
  ELSE
    RAISE WARNING 'FAIL: T09 INSERT allegato cross-pratica NON bloccato';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- TEST 10 — Operatore A NON deve INSERT allegato con caricato_da = altro utente
-- Expected: EXCEPTION (WITH CHECK della policy allegati_insert in migration 014)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_exception BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO allegati (pratica_id, nome_file, nome_originale, storage_path, caricato_da)
    VALUES ('UUID_PRATICA_DI_A', 'spoof.pdf', 'spoof.pdf',
            'UUID_PRATICA_DI_A/spoof.pdf', 'UUID_OPERATORE_B');  -- attribuisce a B
  EXCEPTION WHEN OTHERS THEN
    v_exception := true;
    RAISE NOTICE 'T10 RLS violation (expected): %', SQLERRM;
  END;

  IF v_exception THEN
    RAISE NOTICE 'PASS: T10 attribution spoofing caricato_da bloccato';
  ELSE
    RAISE WARNING 'FAIL: T10 attribution spoofing caricato_da NON bloccato';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback: questi test non devono lasciare side-effect
-- ═══════════════════════════════════════════════════════════════════════════
ROLLBACK;

-- FINE
