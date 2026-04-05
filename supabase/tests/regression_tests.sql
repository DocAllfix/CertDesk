-- Regression tests: SECURITY DEFINER su funzioni critiche
-- Test A: on_pratica_completata cross-user senza updated_by
-- Test B: genera_numero_pratica come operatore con RLS-filtered view

DO $outer$
DECLARE
  v_promemoria_before BIGINT;
  v_promemoria_after  BIGINT;
  v_numero TEXT;
  v_new_id UUID;
  v_ok BOOLEAN;
  v_err TEXT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS reg_results(
    n INT, name TEXT, expected TEXT, actual TEXT, pass BOOLEAN
  ) ON COMMIT DROP;
  GRANT ALL ON reg_results TO authenticated, anon;
  DELETE FROM reg_results;

  -- ═══════════════════════════════════════════════════════════════════════
  -- SETUP Test A: pratica 0005 (firme) con created_by = OP_A
  -- ═══════════════════════════════════════════════════════════════════════
  UPDATE pratiche SET created_by = '8e199ba7-4913-4fda-a10d-6a025ca84c16',
                      updated_by = NULL
   WHERE id = '6efb6470-251e-4a77-8c5b-5ddec46fcf3c';

  SELECT COUNT(*) INTO v_promemoria_before FROM promemoria
   WHERE pratica_id = '6efb6470-251e-4a77-8c5b-5ddec46fcf3c';

  -- ═══════════════════════════════════════════════════════════════════════
  -- TEST A: RESP completa pratica di OP_A senza settare updated_by
  -- Se on_pratica_completata è SECURITY DEFINER → trigger inserisce promemoria ✅
  -- Se fosse SECURITY INVOKER → RLS promemoria_insert blocca → UPDATE rollback ❌
  -- ═══════════════════════════════════════════════════════════════════════
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"52230bff-385c-48d1-add3-9b15e60a1e93","role":"authenticated"}';

  v_ok := false; v_err := NULL;
  BEGIN
    UPDATE pratiche SET fase = 'completata'
     WHERE id = '6efb6470-251e-4a77-8c5b-5ddec46fcf3c';
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  RESET ROLE; RESET request.jwt.claims;

  SELECT COUNT(*) INTO v_promemoria_after FROM promemoria
   WHERE pratica_id = '6efb6470-251e-4a77-8c5b-5ddec46fcf3c';

  INSERT INTO reg_results VALUES(
    101,'RESP completa pratica di OP_A (trigger DEFINER)',
    'UPDATE riuscito',
    CASE WHEN v_ok THEN 'UPDATE riuscito' ELSE 'EXCEPTION: '||COALESCE(v_err,'') END,
    v_ok
  );
  INSERT INTO reg_results VALUES(
    102,'Promemoria creato dal trigger',
    '+1 riga',
    '+'||(v_promemoria_after - v_promemoria_before)::text||' righe',
    (v_promemoria_after - v_promemoria_before) = 1
  );

  -- ═══════════════════════════════════════════════════════════════════════
  -- Cleanup Test A: rollback pratica 0005 allo stato originale
  -- ═══════════════════════════════════════════════════════════════════════
  DELETE FROM promemoria WHERE pratica_id = '6efb6470-251e-4a77-8c5b-5ddec46fcf3c'
    AND created_at > now() - interval '1 minute';
  UPDATE pratiche SET fase = 'firme', created_by = NULL, updated_by = NULL
   WHERE id = '6efb6470-251e-4a77-8c5b-5ddec46fcf3c';
  -- Il cambio fase 'firme'→'completata'→'firme' avrà scritto storico_fasi: non è reversibile
  -- ma accettiamo il side-effect (storico è by-design immutabile)

  -- ═══════════════════════════════════════════════════════════════════════
  -- TEST B: genera_numero_pratica come OP_A (RLS-filtered)
  -- OP_A vede solo 1 pratica (0002). Se trigger NON DEFINER:
  --   MAX(numero visibile) = CERT-2026-0002 → progressivo = 3 → CERT-2026-0003 → COLLIDE
  -- Se DEFINER: MAX = CERT-2026-0006 → CERT-2026-0007 ✅
  -- ═══════════════════════════════════════════════════════════════════════
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"8e199ba7-4913-4fda-a10d-6a025ca84c16","role":"authenticated"}';

  v_ok := false; v_err := NULL; v_numero := NULL; v_new_id := NULL;
  BEGIN
    INSERT INTO pratiche (cliente_id, ciclo, assegnato_a)
    VALUES ('9b162628-617c-4e0e-b4f8-33762a53f9c7','certificazione',
            '8e199ba7-4913-4fda-a10d-6a025ca84c16')
    RETURNING id, numero_pratica INTO v_new_id, v_numero;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  RESET ROLE; RESET request.jwt.claims;

  INSERT INTO reg_results VALUES(
    103,'OP_A crea pratica (INSERT + trigger numero)',
    'INSERT riuscito',
    CASE WHEN v_ok THEN 'INSERT riuscito ('||COALESCE(v_numero,'NULL')||')'
         ELSE 'EXCEPTION: '||COALESCE(v_err,'') END,
    v_ok
  );
  INSERT INTO reg_results VALUES(
    104,'Numero pratica = CERT-2026-0007 (no collision)',
    'CERT-2026-0007',
    COALESCE(v_numero,'NULL'),
    v_numero = 'CERT-2026-0007'
  );

  -- Cleanup Test B
  IF v_new_id IS NOT NULL THEN
    DELETE FROM storico_fasi WHERE pratica_id = v_new_id;
    DELETE FROM notifiche WHERE pratica_id = v_new_id;
    DELETE FROM pratiche WHERE id = v_new_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- TEST C: verifica che OP_A NON possa INSERT pratica con assegnato_a=OP_B (policy WITH CHECK)
  -- ═══════════════════════════════════════════════════════════════════════
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"8e199ba7-4913-4fda-a10d-6a025ca84c16","role":"authenticated"}';

  v_ok := false;
  BEGIN
    INSERT INTO pratiche (cliente_id, ciclo, assegnato_a)
    VALUES ('9b162628-617c-4e0e-b4f8-33762a53f9c7','certificazione',
            'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4');
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;

  RESET ROLE; RESET request.jwt.claims;

  INSERT INTO reg_results VALUES(
    105,'OP_A INSERT pratica con assegnato_a=OP_B','EXCEPTION',
    CASE WHEN v_ok THEN 'EXCEPTION' ELSE 'INSERT riuscito' END, v_ok
  );

END $outer$;

SELECT n, name, expected, actual,
  CASE WHEN pass THEN 'PASS' ELSE 'FAIL' END AS status
FROM reg_results ORDER BY n;
