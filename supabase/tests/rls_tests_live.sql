-- Live RLS Tests — CertDesk (dati reali del DB di produzione)
-- Eseguito via Management API (ruolo postgres) con SET LOCAL ROLE authenticated
-- per simulare utenti reali
--
-- Utenti reali:
--   ADMIN  = 293bb2e0-ca30-41ca-83aa-c75c95dafa40 (Admin Test)
--   RESP   = 52230bff-385c-48d1-add3-9b15e60a1e93 (Responsabile-Test)
--   OP_A   = 8e199ba7-4913-4fda-a10d-6a025ca84c16 (Operatore-a)
--   OP_B   = bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4 (Operatore-b)
-- Pratiche:
--   PRAT_A = fad07ad5-43a0-4540-9655-d2f2d14b7f40 (CERT-2026-0002, prog.verifica, assegnata OP_A)
--   PRAT_B = 98283569-51b4-4a14-809f-6e5c8e2bf3a5 (CERT-2026-0004, prog.verifica, assegnata OP_B)
-- Supporto:
--   NOTIF_A    = 0b9612f7-f31d-463a-a385-2a845a10cc6f (dest=OP_A)
--   ALLEGATO_B = 973f403e-23b2-49bd-8c01-185d85033b61 (pratica=PRAT_B, caricato_da=OP_B)

DO $outer$
DECLARE
  r RECORD;
  cnt BIGINT;
  ok  BOOLEAN;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS test_results(
    n INT, name TEXT, expected TEXT, actual TEXT, pass BOOLEAN
  ) ON COMMIT DROP;
  GRANT ALL ON test_results TO authenticated, anon;
  DELETE FROM test_results;

  -- ═══ TEST 01: OP_A NON vede PRAT_B ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"8e199ba7-4913-4fda-a10d-6a025ca84c16","role":"authenticated"}';
  SELECT COUNT(*) INTO cnt FROM pratiche WHERE id = '98283569-51b4-4a14-809f-6e5c8e2bf3a5';
  INSERT INTO test_results VALUES(1,'OP_A SELECT pratica di OP_B','0',cnt::text,cnt=0);

  -- ═══ TEST 02: OP_A vede PRAT_A (propria) ═══
  SELECT COUNT(*) INTO cnt FROM pratiche WHERE id = 'fad07ad5-43a0-4540-9655-d2f2d14b7f40';
  INSERT INTO test_results VALUES(2,'OP_A SELECT propria pratica','1',cnt::text,cnt=1);

  -- ═══ TEST 03: OP_A UPDATE PRAT_B → 0 righe ═══
  WITH upd AS (UPDATE pratiche SET note = 'hack' WHERE id = '98283569-51b4-4a14-809f-6e5c8e2bf3a5' RETURNING 1)
  SELECT COUNT(*) INTO cnt FROM upd;
  INSERT INTO test_results VALUES(3,'OP_A UPDATE pratica di OP_B','0',cnt::text,cnt=0);

  -- ═══ TEST 04: OP_A vede solo 1 pratica totale ═══
  SELECT COUNT(*) INTO cnt FROM pratiche;
  INSERT INTO test_results VALUES(4,'OP_A count pratiche visibili','1',cnt::text,cnt=1);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 05: OP_B vede solo PRAT_B ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4","role":"authenticated"}';
  SELECT COUNT(*) INTO cnt FROM pratiche;
  INSERT INTO test_results VALUES(5,'OP_B count pratiche visibili','1',cnt::text,cnt=1);

  -- ═══ TEST 06: OP_B NON vede PRAT_A ═══
  SELECT COUNT(*) INTO cnt FROM pratiche WHERE id = 'fad07ad5-43a0-4540-9655-d2f2d14b7f40';
  INSERT INTO test_results VALUES(6,'OP_B SELECT pratica di OP_A','0',cnt::text,cnt=0);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 07: RESPONSABILE vede tutte le 6 pratiche ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"52230bff-385c-48d1-add3-9b15e60a1e93","role":"authenticated"}';
  SELECT COUNT(*) INTO cnt FROM pratiche;
  INSERT INTO test_results VALUES(7,'RESP count pratiche visibili','6',cnt::text,cnt=6);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 08: ADMIN vede tutte le 6 pratiche ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"293bb2e0-ca30-41ca-83aa-c75c95dafa40","role":"authenticated"}';
  SELECT COUNT(*) INTO cnt FROM pratiche;
  INSERT INTO test_results VALUES(8,'ADMIN count pratiche visibili','6',cnt::text,cnt=6);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 09: anon NON vede pratiche ═══
  SET LOCAL ROLE anon;
  RESET request.jwt.claims;
  SELECT COUNT(*) INTO cnt FROM pratiche;
  INSERT INTO test_results VALUES(9,'anon count pratiche','0',cnt::text,cnt=0);

  RESET ROLE;

  -- ═══ TEST 10: OP_B NON legge NOTIF_A ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4","role":"authenticated"}';
  SELECT COUNT(*) INTO cnt FROM notifiche WHERE id = '0b9612f7-f31d-463a-a385-2a845a10cc6f';
  INSERT INTO test_results VALUES(10,'OP_B SELECT notifica di OP_A','0',cnt::text,cnt=0);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 11: OP_A legge la propria NOTIF_A ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"8e199ba7-4913-4fda-a10d-6a025ca84c16","role":"authenticated"}';
  SELECT COUNT(*) INTO cnt FROM notifiche WHERE id = '0b9612f7-f31d-463a-a385-2a845a10cc6f';
  INSERT INTO test_results VALUES(11,'OP_A SELECT propria notifica','1',cnt::text,cnt=1);

  -- ═══ TEST 12: OP_A NON legge ALLEGATO_B (pratica di OP_B) ═══
  SELECT COUNT(*) INTO cnt FROM allegati WHERE id = '973f403e-23b2-49bd-8c01-185d85033b61';
  INSERT INTO test_results VALUES(12,'OP_A SELECT allegato di OP_B','0',cnt::text,cnt=0);

  -- ═══ TEST 13: OP_A INSERT allegato su PRAT_B → EXCEPTION ═══
  ok := false;
  BEGIN
    INSERT INTO allegati (pratica_id, nome_file, nome_originale, storage_path, caricato_da)
    VALUES ('98283569-51b4-4a14-809f-6e5c8e2bf3a5','hack.pdf','hack.pdf',
            '98283569-51b4-4a14-809f-6e5c8e2bf3a5/hack.pdf','8e199ba7-4913-4fda-a10d-6a025ca84c16');
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  INSERT INTO test_results VALUES(13,'OP_A INSERT allegato su pratica OP_B','EXCEPTION',
    CASE WHEN ok THEN 'EXCEPTION' ELSE 'INSERT riuscito' END, ok);

  -- ═══ TEST 14: OP_A INSERT allegato con caricato_da=OP_B (spoofing) → EXCEPTION ═══
  ok := false;
  BEGIN
    INSERT INTO allegati (pratica_id, nome_file, nome_originale, storage_path, caricato_da)
    VALUES ('fad07ad5-43a0-4540-9655-d2f2d14b7f40','spoof.pdf','spoof.pdf',
            'fad07ad5-43a0-4540-9655-d2f2d14b7f40/spoof.pdf','bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4');
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  INSERT INTO test_results VALUES(14,'OP_A spoof caricato_da=OP_B','EXCEPTION',
    CASE WHEN ok THEN 'EXCEPTION' ELSE 'INSERT riuscito' END, ok);

  -- ═══ TEST 15: OP_A INSERT allegato legit su propria pratica → OK ═══
  ok := false;
  BEGIN
    INSERT INTO allegati (pratica_id, nome_file, nome_originale, storage_path, caricato_da)
    VALUES ('fad07ad5-43a0-4540-9655-d2f2d14b7f40','legit.pdf','legit.pdf',
            'fad07ad5-43a0-4540-9655-d2f2d14b7f40/legit.pdf','8e199ba7-4913-4fda-a10d-6a025ca84c16');
    ok := true;
    -- cleanup
    DELETE FROM allegati WHERE storage_path = 'fad07ad5-43a0-4540-9655-d2f2d14b7f40/legit.pdf';
  EXCEPTION WHEN OTHERS THEN ok := false;
  END;
  INSERT INTO test_results VALUES(15,'OP_A INSERT allegato legit su propria pratica','OK',
    CASE WHEN ok THEN 'OK' ELSE 'EXCEPTION' END, ok);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 16: ADMIN UPDATE storico_fasi → 0 righe (immutabile) ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"293bb2e0-ca30-41ca-83aa-c75c95dafa40","role":"authenticated"}';
  WITH upd AS (UPDATE storico_fasi SET motivo = 'tampered' WHERE id = (SELECT id FROM storico_fasi LIMIT 1) RETURNING 1)
  SELECT COUNT(*) INTO cnt FROM upd;
  INSERT INTO test_results VALUES(16,'ADMIN UPDATE storico_fasi (immutabile)','0',cnt::text,cnt=0);

  -- ═══ TEST 17: ADMIN DELETE storico_fasi → 0 righe ═══
  WITH del AS (DELETE FROM storico_fasi WHERE id = (SELECT id FROM storico_fasi LIMIT 1) RETURNING 1)
  SELECT COUNT(*) INTO cnt FROM del;
  INSERT INTO test_results VALUES(17,'ADMIN DELETE storico_fasi (immutabile)','0',cnt::text,cnt=0);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 18: OP_A tenta salto fase (prog.verifica → firme) → EXCEPTION trigger ═══
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"8e199ba7-4913-4fda-a10d-6a025ca84c16","role":"authenticated"}';
  ok := false;
  BEGIN
    UPDATE pratiche SET fase = 'firme' WHERE id = 'fad07ad5-43a0-4540-9655-d2f2d14b7f40';
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  INSERT INTO test_results VALUES(18,'OP_A salto fase prog.verifica→firme','EXCEPTION',
    CASE WHEN ok THEN 'EXCEPTION' ELSE 'UPDATE riuscito' END, ok);

  -- ═══ TEST 19: OP_A tenta fase completata senza prerequisiti → EXCEPTION trigger ═══
  ok := false;
  BEGIN
    UPDATE pratiche SET fase = 'completata' WHERE id = 'fad07ad5-43a0-4540-9655-d2f2d14b7f40';
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  INSERT INTO test_results VALUES(19,'OP_A prog.verifica→completata','EXCEPTION',
    CASE WHEN ok THEN 'EXCEPTION' ELSE 'UPDATE riuscito' END, ok);

  RESET ROLE; RESET request.jwt.claims;

  -- ═══ TEST 20: Verifica SECURITY DEFINER su funzioni critiche ═══
  SELECT COUNT(*) INTO cnt FROM pg_proc p
   WHERE p.proname IN ('genera_numero_pratica','on_pratica_completata','get_user_role','crea_notifica','log_cambio_fase')
     AND p.prosecdef = true;
  INSERT INTO test_results VALUES(20,'5 funzioni SECURITY DEFINER','5',cnt::text,cnt=5);

  -- ═══ TEST 21: Verifica REVOKE PUBLIC su trigger function ═══
  SELECT COUNT(*) INTO cnt FROM pg_proc p
   WHERE p.proname IN ('genera_numero_pratica','on_pratica_completata','log_cambio_fase',
                       'update_updated_at','validate_fase_transition','protect_fase_flags')
     AND NOT has_function_privilege('public', p.oid, 'EXECUTE');
  INSERT INTO test_results VALUES(21,'6 trigger func REVOKE PUBLIC','6',cnt::text,cnt=6);

END $outer$;

SELECT n, name, expected, actual,
  CASE WHEN pass THEN 'PASS' ELSE 'FAIL' END AS status
FROM test_results
ORDER BY n;
