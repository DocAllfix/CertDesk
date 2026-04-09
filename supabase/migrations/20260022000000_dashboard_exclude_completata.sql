-- =============================================================================
-- 20260022 — Dashboard: escludi pratiche completate dai contatori "attive"
-- =============================================================================
-- Problema: totale_attive, per_fase, per_ciclo contavano anche pratiche con
-- fase='completata' (che hanno ancora stato='attiva' finché non archiviate).
-- Fix: aggiungere AND fase != 'completata' ai tre blocchi.
--
-- Atomico, reversibile: se serve rollback, rieseguire la versione da 20260008.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_statistiche_dashboard(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_effective_user_id UUID;
BEGIN
  -- SECURITY: operatore può vedere solo le proprie statistiche
  IF get_user_role() = 'operatore' THEN
    v_effective_user_id := auth.uid();
  ELSE
    v_effective_user_id := p_user_id;
  END IF;

  SELECT json_build_object(
    'totale_attive', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND archiviata = false
        AND fase != 'completata'
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'per_fase', COALESCE((
      SELECT json_object_agg(fase, cnt) FROM (
        SELECT fase::TEXT, COUNT(*) AS cnt FROM pratiche
        WHERE stato = 'attiva' AND archiviata = false
          AND fase != 'completata'
          AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
        GROUP BY fase
      ) sub
    ), '{}'::JSON),
    'per_ciclo', COALESCE((
      SELECT json_object_agg(ciclo, cnt) FROM (
        SELECT ciclo::TEXT, COUNT(*) AS cnt FROM pratiche
        WHERE stato = 'attiva' AND archiviata = false
          AND fase != 'completata'
          AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
        GROUP BY ciclo
      ) sub
    ), '{}'::JSON),
    'scadenze_30gg', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND completata = false
        AND data_scadenza IS NOT NULL
        AND data_scadenza <= CURRENT_DATE + 30
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'scadenze_15gg', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND completata = false
        AND data_scadenza IS NOT NULL
        AND data_scadenza <= CURRENT_DATE + 15
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'completate_mese', (
      SELECT COUNT(*) FROM pratiche
      WHERE completata = true
        AND completata_at >= date_trunc('month', CURRENT_DATE)
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'sospese', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'sospesa'
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'promemoria_attivi', (
      SELECT COUNT(*) FROM promemoria
      WHERE completato = false
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'notifiche_non_lette', (
      SELECT COUNT(*) FROM notifiche
      WHERE letta = false
        AND (v_effective_user_id IS NULL OR destinatario_id = v_effective_user_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_statistiche_dashboard(UUID) IS
  'KPI dashboard — esclude fase completata dai contatori attive (fix 20260022)';
