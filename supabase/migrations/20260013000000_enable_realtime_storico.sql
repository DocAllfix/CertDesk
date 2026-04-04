-- =============================================================================
-- Migration 013 — Aggiunge storico_fasi alla publication Realtime
-- CertDesk
-- =============================================================================
-- Necessario per useUltimaAttivita() (hook dashboard) che ascolta INSERT
-- su storico_fasi per aggiornare il feed attività in tempo reale.
--
-- storico_fasi è append-only (solo INSERT, mai UPDATE/DELETE) per design,
-- quindi il default REPLICA IDENTITY è sufficiente.
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE storico_fasi;
