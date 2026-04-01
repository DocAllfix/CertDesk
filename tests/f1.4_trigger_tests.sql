-- =============================================================================
-- F1.4 — Test di validazione trigger
-- Questo script testa tutti i 5 scenari richiesti dal piano
-- =============================================================================

-- SETUP: Creare dati di test necessari
-- Nota: user_profiles richiede auth.users, usiamo un INSERT diretto
-- poiché eseguiamo come postgres (bypass RLS e FK)
INSERT INTO user_profiles (id, nome, cognome, ruolo, attivo)
VALUES ('00000000-0000-0000-0000-000000000001', 'Admin', 'Test', 'admin', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO clienti (id, nome, ragione_sociale, piva, attivo, created_by)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Cliente Test F1.4',
  'Cliente Test Srl',
  '12345678901',
  true,
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;
