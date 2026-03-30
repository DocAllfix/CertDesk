-- =============================================================================
-- Migration 007 — Indexes e Functions Helper
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- INDICI — esattamente come da DDL_RLS_schema.md
-- ═══════════════════════════════════════════════════════════════════════════

-- Pratiche
CREATE INDEX idx_pratiche_cliente ON pratiche(cliente_id);
CREATE INDEX idx_pratiche_assegnato ON pratiche(assegnato_a);
CREATE INDEX idx_pratiche_fase ON pratiche(fase);
CREATE INDEX idx_pratiche_stato ON pratiche(stato);
CREATE INDEX idx_pratiche_scadenza ON pratiche(data_scadenza);
CREATE INDEX idx_pratiche_fase_assegnato ON pratiche(fase, assegnato_a);
CREATE INDEX idx_pratiche_stato_fase ON pratiche(stato, fase);

-- Notifiche
CREATE INDEX idx_notifiche_destinatario ON notifiche(destinatario_id, letta, created_at DESC);
CREATE INDEX idx_notifiche_pratica ON notifiche(pratica_id);

-- Messaggi interni
CREATE INDEX idx_messaggi_pratica ON messaggi_interni(pratica_id, created_at);

-- Allegati
CREATE INDEX idx_allegati_pratica ON allegati(pratica_id);

-- Storico fasi
CREATE INDEX idx_storico_pratica ON storico_fasi(pratica_id, created_at);

-- Promemoria
CREATE INDEX idx_promemoria_assegnato ON promemoria(assegnato_a, completato, data_scadenza);
CREATE INDEX idx_promemoria_pratica ON promemoria(pratica_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTION: get_user_role()
-- DDL_RLS_schema.md sezione RLS — SECURITY DEFINER STABLE
-- Usata nelle RLS policies per evitare subquery ripetute
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT ruolo FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- OBBLIGATORIO dopo la creazione:
REVOKE ALL ON FUNCTION get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTION: get_pratiche_scadenze(giorni_avviso)
-- DDL_RLS_schema.md — pratiche attive con scadenza entro N giorni
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_pratiche_scadenze(giorni_avviso INT)
RETURNS SETOF pratiche AS $$
  SELECT * FROM pratiche
  WHERE stato = 'attiva'
    AND completata = false
    AND data_scadenza IS NOT NULL
    AND data_scadenza <= CURRENT_DATE + giorni_avviso
  ORDER BY data_scadenza ASC;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_pratiche_scadenze(INT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTION: get_statistiche_dashboard(p_user_id)
-- AGGIUNTA rispetto al DDL — funzione per Dashboard KPI (Fase 9)
-- Se p_user_id è NULL → statistiche globali (admin/responsabile)
-- Se p_user_id è valorizzato → solo pratiche assegnate (operatore)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_statistiche_dashboard(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'totale_attive', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND archiviata = false
        AND (p_user_id IS NULL OR assegnato_a = p_user_id)
    ),
    'per_fase', COALESCE((
      SELECT json_object_agg(fase, cnt) FROM (
        SELECT fase::TEXT, COUNT(*) AS cnt FROM pratiche
        WHERE stato = 'attiva' AND archiviata = false
          AND (p_user_id IS NULL OR assegnato_a = p_user_id)
        GROUP BY fase
      ) sub
    ), '{}'::JSON),
    'per_ciclo', COALESCE((
      SELECT json_object_agg(ciclo, cnt) FROM (
        SELECT ciclo::TEXT, COUNT(*) AS cnt FROM pratiche
        WHERE stato = 'attiva' AND archiviata = false
          AND (p_user_id IS NULL OR assegnato_a = p_user_id)
        GROUP BY ciclo
      ) sub
    ), '{}'::JSON),
    'scadenze_30gg', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND completata = false
        AND data_scadenza IS NOT NULL
        AND data_scadenza <= CURRENT_DATE + 30
        AND (p_user_id IS NULL OR assegnato_a = p_user_id)
    ),
    'scadenze_15gg', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND completata = false
        AND data_scadenza IS NOT NULL
        AND data_scadenza <= CURRENT_DATE + 15
        AND (p_user_id IS NULL OR assegnato_a = p_user_id)
    ),
    'completate_mese', (
      SELECT COUNT(*) FROM pratiche
      WHERE completata = true
        AND completata_at >= date_trunc('month', CURRENT_DATE)
        AND (p_user_id IS NULL OR assegnato_a = p_user_id)
    ),
    'sospese', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'sospesa'
        AND (p_user_id IS NULL OR assegnato_a = p_user_id)
    ),
    'promemoria_attivi', (
      SELECT COUNT(*) FROM promemoria
      WHERE completato = false
        AND (p_user_id IS NULL OR assegnato_a = p_user_id)
    ),
    'notifiche_non_lette', (
      SELECT COUNT(*) FROM notifiche
      WHERE letta = false
        AND (p_user_id IS NULL OR destinatario_id = p_user_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_statistiche_dashboard(UUID) IS 'AGGIUNTA: KPI dashboard per Fase 9 — non nel DDL originale';

REVOKE ALL ON FUNCTION get_statistiche_dashboard(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_statistiche_dashboard(UUID) TO authenticated;
