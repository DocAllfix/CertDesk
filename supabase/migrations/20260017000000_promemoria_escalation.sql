-- =============================================================================
-- Migration 017 — Tabella tracking escalation promemoria
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================
-- Traccia quali notifiche di escalation pre-scadenza sono state inviate per
-- ogni promemoria (sorveglianza e non). Stessa logica di notifiche_scadenza_inviate
-- ma con PK (promemoria_id, giorni_soglia) perché una pratica può avere
-- più promemoria indipendenti.
--
-- Usata dalla Parte D del cron-scadenze per garantire idempotenza.

CREATE TABLE IF NOT EXISTS notifiche_promemoria_escalation (
  promemoria_id UUID NOT NULL REFERENCES promemoria(id) ON DELETE CASCADE,
  giorni_soglia INT  NOT NULL, -- 60, 30, 14, 7, 1, 0
  inviata_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (promemoria_id, giorni_soglia)
);

CREATE INDEX IF NOT EXISTS idx_notifiche_prom_escalation_promemoria
  ON notifiche_promemoria_escalation(promemoria_id);

ALTER TABLE notifiche_promemoria_escalation ENABLE ROW LEVEL SECURITY;

-- Lettura per admin (debug/monitoraggio). Il cron usa service_role → bypassa RLS.
CREATE POLICY "Admin lettura promemoria escalation"
  ON notifiche_promemoria_escalation FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin');
