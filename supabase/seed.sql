-- =============================================================================
-- CertDesk — seed.sql
-- Dati iniziali per sviluppo e test locale.
-- NON usare in produzione: gli utenti reali vengono creati dall'admin
-- tramite il dashboard Supabase o uno script dedicato.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NORME CATALOGO — 17 norme ISO (valori fissi, uguali per tutti i clienti)
-- -----------------------------------------------------------------------------
INSERT INTO norme_catalogo (codice, nome, ordine) VALUES
  ('ISO 9001',      'Sistemi di gestione della qualità (SGQ)',                1),
  ('ISO 14001',     'Sistemi di gestione ambientale (SGA)',                   2),
  ('ISO 45001',     'Salute e sicurezza sul lavoro (SGSL)',                   3),
  ('SA 8000',       'Responsabilità sociale d''impresa',                      4),
  ('PAS 24000',     'Sistema di gestione sociale (SMS)',                      5),
  ('PDR 125/2022',  'Parità di genere',                                       6),
  ('ESG-EASI',      'Sostenibilità e responsabilità sociale',                 7),
  ('ISO 37001',     'Sistemi anti-corruzione',                                8),
  ('ISO 39001',     'Sicurezza stradale (RGMS)',                              9),
  ('ISO 50001',     'Gestione dell''energia (SGE)',                           10),
  ('ISO 27001',     'Sicurezza delle informazioni (SGSI)',                    11),
  ('ISO 14064-1',   'Emissioni gas serra',                                    12),
  ('ISO 30415',     'Diversità e inclusione HR',                              13),
  ('ISO 13009',     'Operatori di spiaggia',                                  14),
  ('ISO 20121',     'Sostenibilità eventi',                                   15),
  ('EN 1090',       'Strutture in acciaio e alluminio',                       16),
  ('ISO 3834',      'Qualità nella saldatura',                                17)
ON CONFLICT (codice) DO NOTHING;

-- -----------------------------------------------------------------------------
-- UTENTI DI TEST
-- Le credenziali qui sotto sono SOLO per sviluppo locale.
-- In produzione gli utenti vengono creati dall'admin via dashboard Supabase.
--
-- Per creare gli utenti auth.users devi usare il dashboard Supabase locale
-- (http://localhost:54323) o la Supabase CLI dopo aver avviato i servizi.
-- Qui inseriamo solo i profili, assumendo che auth.users sia già popolato
-- con gli UUID corrispondenti tramite script o dashboard.
--
-- UUID fissi per dev (non cambiarli — usati nelle pratiche di esempio):
--   admin:        00000000-0000-0000-0000-000000000001
--   responsabile: 00000000-0000-0000-0000-000000000002
--   operatore:    00000000-0000-0000-0000-000000000003
-- -----------------------------------------------------------------------------
INSERT INTO user_profiles (id, nome, cognome, ruolo, attivo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Marco',    'Bianchi',   'admin',        true),
  ('00000000-0000-0000-0000-000000000002', 'Laura',    'Ferretti',  'responsabile', true),
  ('00000000-0000-0000-0000-000000000003', 'Giovanni', 'Russo',     'operatore',    true)
ON CONFLICT (id) DO NOTHING;

-- Responsabile norme: Laura gestisce qualità e ambiente
INSERT INTO responsabili_norme (user_id, norma_codice) VALUES
  ('00000000-0000-0000-0000-000000000002', 'ISO 9001'),
  ('00000000-0000-0000-0000-000000000002', 'ISO 14001'),
  ('00000000-0000-0000-0000-000000000002', 'ISO 45001')
ON CONFLICT (user_id, norma_codice) DO NOTHING;

-- -----------------------------------------------------------------------------
-- CONSULENTI DI ESEMPIO
-- -----------------------------------------------------------------------------
INSERT INTO consulenti (id, nome, cognome, email, telefono, azienda, attivo) VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'Antonio', 'Marino',
    'a.marino@consulenze-iso.it',
    '+39 335 1234567',
    'Marino Consulenze ISO Srl',
    true
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Stefania', 'Conti',
    's.conti@qualitaplus.it',
    '+39 347 9876543',
    'QualitàPlus Srl',
    true
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO consulenti_norme (consulente_id, norma_codice) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'ISO 9001'),
  ('c0000000-0000-0000-0000-000000000001', 'ISO 14001'),
  ('c0000000-0000-0000-0000-000000000002', 'ISO 45001'),
  ('c0000000-0000-0000-0000-000000000002', 'ISO 9001')
ON CONFLICT (consulente_id, norma_codice) DO NOTHING;

-- -----------------------------------------------------------------------------
-- CLIENTI DI ESEMPIO
-- -----------------------------------------------------------------------------
INSERT INTO clienti (id, nome, ragione_sociale, piva, email, pec, telefono,
                     indirizzo, citta, cap, codice_ea, numero_dipendenti,
                     attivo, created_by) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Metalmeccanica Rossi',
    'Metalmeccanica Rossi Spa',
    '01234567890',
    'info@metalmeccanica-rossi.it',
    'metalmeccanica-rossi@pec.it',
    '+39 02 12345678',
    'Via dell''Industria 42',
    'Milano',
    '20100',
    'EA 17',
    120,
    true,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Logistica Verde',
    'Logistica Verde Srl',
    '09876543210',
    'admin@logistica-verde.it',
    'logistica-verde@pec.it',
    '+39 06 98765432',
    'Via della Logistica 15',
    'Roma',
    '00100',
    'EA 30',
    45,
    true,
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Edilizia Mancini',
    'Edilizia Mancini & Figli Sas',
    '05555555550',
    'info@edilizia-mancini.it',
    'edilizia-mancini@pec.it',
    '+39 081 5554321',
    'Via Napoli 88',
    'Napoli',
    '80100',
    'EA 28',
    18,
    true,
    '00000000-0000-0000-0000-000000000002'
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PRATICHE DI ESEMPIO — una per fase, così copriamo tutto il workflow
-- I numero_pratica vengono generati dal trigger set_numero_pratica,
-- quindi non li impostiamo qui.
-- -----------------------------------------------------------------------------

-- Pratica 1: Fase 1 — Contratto firmato (fase iniziale)
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id,
  referente_nome, referente_email, referente_tel,
  note, priorita, created_by, updated_by
) VALUES (
  'p0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',  -- Metalmeccanica Rossi
  'certificazione',
  'contratto_firmato',
  'attiva',
  '00000000-0000-0000-0000-000000000002',  -- assegnata a Laura
  'c0000000-0000-0000-0000-000000000001',  -- consulente Antonio Marino
  'Roberto Rossi', 'r.rossi@metalmeccanica-rossi.it', '+39 335 0001111',
  'Prima certificazione ISO 9001. Cliente storico, ottima collaborazione.',
  1,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p0000000-0000-0000-0000-000000000001', 'ISO 9001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;

-- Pratica 2: Fase 2 — Programmazione verifica (data_verifica impostata)
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id,
  referente_nome, referente_email, referente_tel,
  data_verifica, auditor_id, sede_verifica,
  note, priorita, created_by, updated_by
) VALUES (
  'p0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',  -- Logistica Verde
  'prima_sorveglianza',
  'programmazione_verifica',
  'attiva',
  '00000000-0000-0000-0000-000000000003',  -- assegnata a Giovanni
  'c0000000-0000-0000-0000-000000000002',  -- consulente Stefania Conti
  'Elena Verdi', 'e.verdi@logistica-verde.it', '+39 347 2223334',
  (CURRENT_DATE + INTERVAL '30 days')::date,
  '00000000-0000-0000-0000-000000000002',  -- auditor Laura
  'Sede principale Roma, Via della Logistica 15',
  'Prima sorveglianza dopo certificazione ISO 14001 dello scorso anno.',
  0,
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p0000000-0000-0000-0000-000000000002', 'ISO 14001'),
  ('p0000000-0000-0000-0000-000000000002', 'ISO 45001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;

-- Pratica 3: Fase 4 — Elaborazione pratica BLOCCATA (documenti_ricevuti = false)
-- Caso tipico da mostrare nel test: alert rosso blocco documenti
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a,
  referente_nome, referente_email, referente_tel,
  data_verifica, auditor_id, sede_verifica,
  proforma_richiesta, proforma_emessa, proforma_emessa_at,
  documenti_ricevuti,
  note, priorita, created_by, updated_by
) VALUES (
  'p0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000003',  -- Edilizia Mancini
  'ricertificazione',
  'elaborazione_pratica',
  'attiva',
  '00000000-0000-0000-0000-000000000002',  -- assegnata a Laura
  'Carlo Mancini', 'c.mancini@edilizia-mancini.it', '+39 081 0009876',
  (CURRENT_DATE - INTERVAL '15 days')::date,
  '00000000-0000-0000-0000-000000000002',
  'Cantiere Napoli Est, Via Napoli 88',
  true, true, (NOW() - INTERVAL '10 days'),
  false,  -- BLOCCATA: documenti non ancora ricevuti
  'Ricertificazione ISO 9001. In attesa documentazione dal cliente.',
  2,  -- alta priorità
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p0000000-0000-0000-0000-000000000003', 'ISO 9001'),
  ('p0000000-0000-0000-0000-000000000003', 'ISO 45001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PROMEMORIA DI ESEMPIO
-- -----------------------------------------------------------------------------
INSERT INTO promemoria (
  id, pratica_id, creato_da, assegnato_a,
  testo, data_scadenza, completato
) VALUES
  (
    'r0000000-0000-0000-0000-000000000001',
    'p0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'Sollecitare Edilizia Mancini per invio documentazione mancante (verbali audit, planimetrie)',
    (CURRENT_DATE + INTERVAL '3 days')::date,
    false
  ),
  (
    'r0000000-0000-0000-0000-000000000002',
    NULL,  -- promemoria globale, non legato a pratica specifica
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Revisione tariffario certificazioni — aggiornamento prezzi 2026',
    (CURRENT_DATE + INTERVAL '14 days')::date,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Fine seed.sql
-- Per resettare il db locale: supabase db reset
-- Per applicare solo le migration: supabase db push
-- -----------------------------------------------------------------------------
