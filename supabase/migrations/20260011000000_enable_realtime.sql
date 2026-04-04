-- =============================================================================
-- Migration 011 — Abilita Supabase Realtime per notifiche e messaggi_interni
-- CertDesk
-- =============================================================================
-- NOTA: La publication supabase_realtime esiste per default nei progetti
-- Supabase Cloud ma senza tabelle. Questo aggiunge le due tabelle che
-- richiedono postgres_changes (INSERT) per i canali Realtime attivi:
--
--   useNotificheSubscription → notifiche (INSERT per campanellina live)
--   useMessaggiPratica       → messaggi_interni (INSERT per feed live)
--
-- Non serve REPLICA IDENTITY FULL: entrambe le subscription ascoltano
-- solo eventi INSERT, per cui il default è sufficiente.
-- Nessun impatto su RLS, trigger, query esistenti.
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifiche;
ALTER PUBLICATION supabase_realtime ADD TABLE messaggi_interni;
