-- =============================================================================
-- CertDesk — test-data-seed.sql
-- Dati di test realistici per test funzionali manuali.
--
-- Contenuto: 5 clienti, 3 consulenti, 8 pratiche in fasi diverse.
--
-- PREREQUISITI:
--   - Migration applicate (tutte le tabelle, trigger, norme_catalogo)
--   - Utenti auth.users + user_profiles gia creati:
--       Admin:        293bb2e0-ca30-41ca-83aa-c75c95dafa40
--       Responsabile: 52230bff-385c-48d1-add3-9b15e60a1e93
--       Operatore-A:  8e199ba7-4913-4fda-a10d-6a025ca84c16
--       Operatore-B:  bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4
--
-- ESECUZIONE:
--   Supabase SQL Editor > incolla ed esegui
--   Oppure: psql -f tests/test-data-seed.sql
--
-- NOTA: I numero_pratica vengono generati dal trigger set_numero_pratica,
--       non serve specificarli. Le pratiche in fasi avanzate bypassano i
--       trigger di transizione perche vengono inserite direttamente nella
--       fase target (INSERT, non UPDATE).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- VARIABILI UUID utenti (per leggibilita)
-- ─────────────────────────────────────────────────────────────────────────────
-- Admin:        293bb2e0-ca30-41ca-83aa-c75c95dafa40
-- Responsabile: 52230bff-385c-48d1-add3-9b15e60a1e93
-- Operatore-A:  8e199ba7-4913-4fda-a10d-6a025ca84c16
-- Operatore-B:  bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4


-- =============================================================================
-- 1. CLIENTI (5)
-- =============================================================================

INSERT INTO clienti (id, nome, ragione_sociale, piva, codice_fiscale, email, pec, telefono, indirizzo, citta, cap, codice_ea, codice_nace, numero_dipendenti, note, attivo, created_by)
VALUES
  -- C1: Azienda metalmeccanica grande
  (
    'c1000000-test-0000-0000-000000000001',
    'Acciaio Forte Spa',
    'Acciaio Forte Spa',
    '01234567890',
    'ACCFRT80A01H501X',
    'info@acciaioforte.it',
    'acciaioforte@pec.it',
    '+39 02 12345678',
    'Via dell''Industria 42',
    'Milano',
    '20100',
    'EA 17',
    '25.11',
    250,
    'Cliente storico, terza ricertificazione in corso.',
    true,
    '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
  ),
  -- C2: Azienda logistica media
  (
    'c1000000-test-0000-0000-000000000002',
    'TransLog Italia Srl',
    'TransLog Italia Srl',
    '09876543210',
    NULL,
    'admin@translog.it',
    'translog@pec.it',
    '+39 06 98765432',
    'Via della Logistica 15',
    'Roma',
    '00144',
    'EA 31',
    '49.41',
    85,
    NULL,
    true,
    '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
  ),
  -- C3: Impresa edile piccola
  (
    'c1000000-test-0000-0000-000000000003',
    'Edilizia Verde Sas',
    'Edilizia Verde di Bianchi & C. Sas',
    '05555555550',
    NULL,
    'info@ediliziaverde.it',
    NULL,
    '+39 081 5554321',
    'Via Napoli 88',
    'Napoli',
    '80100',
    'EA 28',
    '41.20',
    18,
    'Primo approccio alla certificazione ISO.',
    true,
    '52230bff-385c-48d1-add3-9b15e60a1e93'
  ),
  -- C4: Studio professionale
  (
    'c1000000-test-0000-0000-000000000004',
    'Studio Ingegneria Conti',
    'Studio Conti & Associati',
    '11223344556',
    NULL,
    'segreteria@studioconti.it',
    'studioconti@pec.it',
    '+39 055 1112233',
    'Piazza della Repubblica 7',
    'Firenze',
    '50123',
    'EA 34',
    '71.12',
    12,
    'Certificazione parita di genere richiesta dal bando pubblico.',
    true,
    '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
  ),
  -- C5: Cooperativa sociale
  (
    'c1000000-test-0000-0000-000000000005',
    'Coop Solidale Onlus',
    'Cooperativa Solidale Societa Cooperativa Sociale',
    '99887766554',
    NULL,
    'info@coopsolidale.org',
    'coopsolidale@pec.it',
    '+39 011 9998877',
    'Corso Vittorio Emanuele 120',
    'Torino',
    '10121',
    'EA 38',
    '88.99',
    45,
    'Interessata a SA 8000 e responsabilita sociale.',
    true,
    '52230bff-385c-48d1-add3-9b15e60a1e93'
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 2. CONSULENTI (3)
-- =============================================================================

INSERT INTO consulenti (id, nome, cognome, email, telefono, azienda, note, attivo)
VALUES
  -- K1: Consulente qualita e ambiente
  (
    'k1000000-test-0000-0000-000000000001',
    'Antonio',
    'Marino',
    'a.marino@consulenze-iso.it',
    '+39 335 1234567',
    'Marino Consulenze ISO Srl',
    'Esperto ISO 9001 e 14001, 15 anni di esperienza.',
    true
  ),
  -- K2: Consulente sicurezza
  (
    'k1000000-test-0000-0000-000000000002',
    'Stefania',
    'Conti',
    's.conti@qualitaplus.it',
    '+39 347 9876543',
    'QualitaPlus Srl',
    'Specializzata in ISO 45001 e SA 8000.',
    true
  ),
  -- K3: Consulente energia e sostenibilita
  (
    'k1000000-test-0000-0000-000000000003',
    'Roberto',
    'Ferri',
    'r.ferri@greenadvisors.it',
    '+39 320 5556789',
    'Green Advisors Srl',
    'Focus su ISO 50001, ISO 14064-1, ESG.',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Norme gestite dai consulenti
INSERT INTO consulenti_norme (consulente_id, norma_codice) VALUES
  ('k1000000-test-0000-0000-000000000001', 'ISO 9001'),
  ('k1000000-test-0000-0000-000000000001', 'ISO 14001'),
  ('k1000000-test-0000-0000-000000000002', 'ISO 45001'),
  ('k1000000-test-0000-0000-000000000002', 'SA 8000'),
  ('k1000000-test-0000-0000-000000000002', 'PDR 125/2022'),
  ('k1000000-test-0000-0000-000000000003', 'ISO 50001'),
  ('k1000000-test-0000-0000-000000000003', 'ISO 14064-1'),
  ('k1000000-test-0000-0000-000000000003', 'ESG-EASI')
ON CONFLICT (consulente_id, norma_codice) DO NOTHING;


-- =============================================================================
-- 3. PRATICHE (8) — in fasi diverse per coprire tutto il workflow
--
-- NOTA: Le pratiche vengono inserite direttamente nella fase target.
-- Il trigger validate_fase_transition si attiva solo su UPDATE OF fase,
-- non su INSERT, quindi possiamo creare pratiche in qualsiasi fase.
-- I campi prerequisito (data_verifica, proforma_emessa, documenti_ricevuti)
-- sono coerenti con la fase in cui si trova la pratica.
-- =============================================================================

-- P1: Fase 1 — Contratto Firmato (appena creata)
-- Cliente: Acciaio Forte | Norma: ISO 9001 | Ciclo: Certificazione
-- Assegnata a: Operatore-A
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id, auditor_id,
  referente_nome, referente_email, referente_tel,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000001',
  'c1000000-test-0000-0000-000000000001',
  'certificazione',
  'contratto_firmato',
  'attiva',
  '8e199ba7-4913-4fda-a10d-6a025ca84c16',   -- Operatore-A
  'k1000000-test-0000-0000-000000000001',    -- Antonio Marino
  NULL,
  'Roberto Acciai', 'r.acciai@acciaioforte.it', '+39 335 0001111',
  (CURRENT_DATE + INTERVAL '90 days')::date,
  'Prima certificazione ISO 9001. Cliente grande, richiede attenzione.',
  1,
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000001', 'ISO 9001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- P2: Fase 2 — Programmazione Verifica
-- Cliente: TransLog | Norme: ISO 14001 + ISO 45001 | Ciclo: Prima Sorveglianza
-- Assegnata a: Operatore-A | Auditor: Responsabile
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id, auditor_id,
  referente_nome, referente_email, referente_tel,
  data_verifica, sede_verifica,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000002',
  'c1000000-test-0000-0000-000000000002',
  'prima_sorveglianza',
  'programmazione_verifica',
  'attiva',
  '8e199ba7-4913-4fda-a10d-6a025ca84c16',   -- Operatore-A
  'k1000000-test-0000-0000-000000000002',    -- Stefania Conti
  '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Auditor: Responsabile
  'Elena Verdi', 'e.verdi@translog.it', '+39 347 2223334',
  (CURRENT_DATE + INTERVAL '25 days')::date,
  'Sede principale Roma, Via della Logistica 15',
  (CURRENT_DATE + INTERVAL '60 days')::date,
  'Prima sorveglianza ambiente + sicurezza. Data verifica fissata tra 25 giorni.',
  0,
  '52230bff-385c-48d1-add3-9b15e60a1e93',
  '52230bff-385c-48d1-add3-9b15e60a1e93'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000002', 'ISO 14001'),
  ('p1000000-test-0000-0000-000000000002', 'ISO 45001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- P3: Fase 3 — Richiesta Proforma
-- Cliente: Edilizia Verde | Norma: ISO 9001 | Ciclo: Certificazione
-- Assegnata a: Operatore-B
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id, auditor_id,
  referente_nome, referente_email, referente_tel,
  data_verifica, sede_verifica,
  proforma_richiesta,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000003',
  'c1000000-test-0000-0000-000000000003',
  'certificazione',
  'richiesta_proforma',
  'attiva',
  'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4',   -- Operatore-B
  'k1000000-test-0000-0000-000000000001',    -- Antonio Marino
  '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Auditor: Responsabile
  'Marco Bianchi', 'm.bianchi@ediliziaverde.it', '+39 081 9998877',
  (CURRENT_DATE + INTERVAL '15 days')::date,
  'Cantiere principale Napoli, Via Napoli 88',
  true,
  (CURRENT_DATE + INTERVAL '75 days')::date,
  'Certificazione ISO 9001 per bando appalti pubblici. Proforma da emettere.',
  1,
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000003', 'ISO 9001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- P4: Fase 4 — Elaborazione Pratica BLOCCATA (documenti_ricevuti = false)
-- Cliente: Acciaio Forte | Norma: ISO 14001 | Ciclo: Ricertificazione
-- Assegnata a: Operatore-B
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id, auditor_id,
  referente_nome, referente_email, referente_tel,
  data_verifica, sede_verifica,
  proforma_richiesta, proforma_emessa, proforma_emessa_at,
  documenti_ricevuti,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000004',
  'c1000000-test-0000-0000-000000000001',
  'ricertificazione',
  'elaborazione_pratica',
  'attiva',
  'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4',   -- Operatore-B
  'k1000000-test-0000-0000-000000000001',    -- Antonio Marino
  '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Auditor: Responsabile
  'Roberto Acciai', 'r.acciai@acciaioforte.it', '+39 335 0001111',
  (CURRENT_DATE - INTERVAL '20 days')::date,
  'Stabilimento Acciaio Forte, Via dell''Industria 42, Milano',
  true, true, (NOW() - INTERVAL '12 days'),
  false,  -- <<<< BLOCCATA: documenti NON ricevuti
  (CURRENT_DATE + INTERVAL '30 days')::date,
  'Ricertificazione ISO 14001. BLOCCATA: in attesa documenti dal cliente. Sollecitare.',
  2,  -- alta priorita
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000004', 'ISO 14001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- P5: Fase 4 — Elaborazione Pratica SBLOCCATA (documenti OK)
-- Cliente: Studio Conti | Norma: PDR 125/2022 | Ciclo: Certificazione
-- Assegnata a: Operatore-A
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id, auditor_id,
  referente_nome, referente_email, referente_tel,
  data_verifica, sede_verifica,
  proforma_richiesta, proforma_emessa, proforma_emessa_at,
  documenti_ricevuti, documenti_ricevuti_at,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000005',
  'c1000000-test-0000-0000-000000000004',
  'certificazione',
  'elaborazione_pratica',
  'attiva',
  '8e199ba7-4913-4fda-a10d-6a025ca84c16',   -- Operatore-A
  'k1000000-test-0000-0000-000000000002',    -- Stefania Conti
  '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Auditor: Responsabile
  'Giulia Conti', 'g.conti@studioconti.it', '+39 055 4445566',
  (CURRENT_DATE - INTERVAL '10 days')::date,
  'Studio Conti, Piazza della Repubblica 7, Firenze',
  true, true, (NOW() - INTERVAL '8 days'),
  true, (NOW() - INTERVAL '3 days'),
  (CURRENT_DATE + INTERVAL '45 days')::date,
  'Parita di genere per bando pubblico. Documenti ricevuti, elaborazione in corso.',
  1,
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000005', 'PDR 125/2022')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- P6: Fase 5 — Firme
-- Cliente: Coop Solidale | Norma: SA 8000 | Ciclo: Certificazione
-- Assegnata a: Operatore-B
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id, auditor_id,
  referente_nome, referente_email, referente_tel,
  data_verifica, sede_verifica,
  proforma_richiesta, proforma_emessa, proforma_emessa_at,
  documenti_ricevuti, documenti_ricevuti_at,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000006',
  'c1000000-test-0000-0000-000000000005',
  'certificazione',
  'firme',
  'attiva',
  'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4',   -- Operatore-B
  'k1000000-test-0000-0000-000000000002',    -- Stefania Conti
  '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Auditor: Responsabile
  'Paolo Solidale', 'p.solidale@coopsolidale.org', '+39 011 7778899',
  (CURRENT_DATE - INTERVAL '30 days')::date,
  'Sede Coop Solidale, Corso Vittorio Emanuele 120, Torino',
  true, true, (NOW() - INTERVAL '25 days'),
  true, (NOW() - INTERVAL '15 days'),
  (CURRENT_DATE + INTERVAL '20 days')::date,
  'SA 8000 quasi completata. In attesa firma del legale rappresentante.',
  0,
  '52230bff-385c-48d1-add3-9b15e60a1e93',
  '52230bff-385c-48d1-add3-9b15e60a1e93'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000006', 'SA 8000')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- P7: Fase 6 — Completata
-- Cliente: TransLog | Norma: ISO 9001 | Ciclo: Seconda Sorveglianza
-- Assegnata a: Operatore-A
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id, auditor_id,
  referente_nome, referente_email, referente_tel,
  data_verifica, sede_verifica,
  proforma_richiesta, proforma_emessa, proforma_emessa_at,
  documenti_ricevuti, documenti_ricevuti_at,
  completata, completata_at,
  sorveglianza_reminder_creato,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000007',
  'c1000000-test-0000-0000-000000000002',
  'seconda_sorveglianza',
  'completata',
  'attiva',
  '8e199ba7-4913-4fda-a10d-6a025ca84c16',   -- Operatore-A
  'k1000000-test-0000-0000-000000000001',    -- Antonio Marino
  '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Auditor: Responsabile
  'Elena Verdi', 'e.verdi@translog.it', '+39 347 2223334',
  (CURRENT_DATE - INTERVAL '60 days')::date,
  'Sede Roma',
  true, true, (NOW() - INTERVAL '50 days'),
  true, (NOW() - INTERVAL '40 days'),
  true, (NOW() - INTERVAL '7 days'),
  true,
  (CURRENT_DATE - INTERVAL '5 days')::date,
  'Seconda sorveglianza completata con successo. Nessuna non conformita.',
  0,
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000007', 'ISO 9001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- P8: Pratica SOSPESA — per test Scenario 5
-- Cliente: Edilizia Verde | Norma: ISO 45001 | Ciclo: Certificazione
-- Assegnata a: Operatore-A
INSERT INTO pratiche (
  id, cliente_id, ciclo, fase, stato,
  assegnato_a, consulente_id,
  referente_nome, referente_email, referente_tel,
  data_scadenza, note, priorita,
  created_by, updated_by
) VALUES (
  'p1000000-test-0000-0000-000000000008',
  'c1000000-test-0000-0000-000000000003',
  'certificazione',
  'programmazione_verifica',
  'sospesa',
  '8e199ba7-4913-4fda-a10d-6a025ca84c16',   -- Operatore-A
  'k1000000-test-0000-0000-000000000002',    -- Stefania Conti
  'Marco Bianchi', 'm.bianchi@ediliziaverde.it', '+39 081 9998877',
  (CURRENT_DATE + INTERVAL '120 days')::date,
  'SOSPESA: cliente ha chiesto pausa per ristrutturazione cantiere. Ripresa prevista tra 2 mesi.',
  0,
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
  '293bb2e0-ca30-41ca-83aa-c75c95dafa40'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO pratiche_norme (pratica_id, norma_codice) VALUES
  ('p1000000-test-0000-0000-000000000008', 'ISO 45001')
ON CONFLICT (pratica_id, norma_codice) DO NOTHING;


-- =============================================================================
-- 4. PROMEMORIA (3)
-- =============================================================================

INSERT INTO promemoria (id, pratica_id, creato_da, assegnato_a, testo, data_scadenza, completato)
VALUES
  -- Promemoria 1: Sollecito documenti pratica P4 (bloccata)
  (
    'r1000000-test-0000-0000-000000000001',
    'p1000000-test-0000-0000-000000000004',
    '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
    'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4',   -- Operatore-B
    'Sollecitare Acciaio Forte per invio documentazione mancante ISO 14001 (verbali audit interni, planimetrie aggiornate)',
    (CURRENT_DATE + INTERVAL '3 days')::date,
    false
  ),
  -- Promemoria 2: Preparazione audit P5
  (
    'r1000000-test-0000-0000-000000000002',
    'p1000000-test-0000-0000-000000000005',
    '52230bff-385c-48d1-add3-9b15e60a1e93',
    '8e199ba7-4913-4fda-a10d-6a025ca84c16',   -- Operatore-A
    'Preparare checklist audit PDR 125/2022 per Studio Conti. Verificare indicatori gender gap.',
    (CURRENT_DATE + INTERVAL '7 days')::date,
    false
  ),
  -- Promemoria 3: Sorveglianza pratica P7 completata (simula trigger)
  (
    'r1000000-test-0000-0000-000000000003',
    'p1000000-test-0000-0000-000000000007',
    '293bb2e0-ca30-41ca-83aa-c75c95dafa40',
    '8e199ba7-4913-4fda-a10d-6a025ca84c16',   -- Operatore-A
    'Sorveglianza ISO 9001 per pratica TransLog — verificare scadenza ciclo certificativo',
    (CURRENT_DATE + INTERVAL '358 days')::date,
    false
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 5. MESSAGGI INTERNI (4) — per la pratica P4 bloccata
-- =============================================================================

INSERT INTO messaggi_interni (id, pratica_id, mittente_id, destinatario_id, tipo, testo)
VALUES
  (
    'm1000000-test-0000-0000-000000000001',
    'p1000000-test-0000-0000-000000000004',
    '293bb2e0-ca30-41ca-83aa-c75c95dafa40',   -- Admin
    'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4',   -- a Operatore-B
    'richiesta',
    'Per favore sollecita il cliente Acciaio Forte per i documenti mancanti della ricertificazione ISO 14001. Servono verbali audit interni e planimetrie aggiornate.'
  ),
  (
    'm1000000-test-0000-0000-000000000002',
    'p1000000-test-0000-0000-000000000004',
    'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4',   -- Operatore-B
    '293bb2e0-ca30-41ca-83aa-c75c95dafa40',   -- a Admin
    'commento',
    'Ho inviato email di sollecito al referente Roberto Acciai. Ha confermato che inviera i documenti entro venerdi.'
  ),
  (
    'm1000000-test-0000-0000-000000000003',
    'p1000000-test-0000-0000-000000000004',
    '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Responsabile
    NULL,                                       -- a Tutti
    'commento',
    'Attenzione: la scadenza per questa pratica si avvicina. Se i documenti non arrivano entro la prossima settimana, consideriamo di contattare direttamente la direzione.'
  ),
  (
    'm1000000-test-0000-0000-000000000004',
    'p1000000-test-0000-0000-000000000006',
    '52230bff-385c-48d1-add3-9b15e60a1e93',   -- Responsabile
    'bcc2da6c-6cfa-4e54-8fd4-1d07635ee1d4',   -- a Operatore-B
    'richiesta',
    'La pratica SA 8000 di Coop Solidale e quasi pronta. Verificare che il legale rappresentante abbia firmato tutti i documenti prima di procedere al completamento.'
  )
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 6. STORICO FASI — per la pratica P7 completata (audit trail)
-- =============================================================================

INSERT INTO storico_fasi (pratica_id, fase_precedente, fase_nuova, cambiato_da, motivo, created_at)
VALUES
  ('p1000000-test-0000-0000-000000000007', 'contratto_firmato', 'programmazione_verifica',
   '293bb2e0-ca30-41ca-83aa-c75c95dafa40', NULL, NOW() - INTERVAL '55 days'),
  ('p1000000-test-0000-0000-000000000007', 'programmazione_verifica', 'richiesta_proforma',
   '293bb2e0-ca30-41ca-83aa-c75c95dafa40', NULL, NOW() - INTERVAL '45 days'),
  ('p1000000-test-0000-0000-000000000007', 'richiesta_proforma', 'elaborazione_pratica',
   '52230bff-385c-48d1-add3-9b15e60a1e93', NULL, NOW() - INTERVAL '35 days'),
  ('p1000000-test-0000-0000-000000000007', 'elaborazione_pratica', 'firme',
   '52230bff-385c-48d1-add3-9b15e60a1e93', NULL, NOW() - INTERVAL '20 days'),
  ('p1000000-test-0000-0000-000000000007', 'firme', 'completata',
   '293bb2e0-ca30-41ca-83aa-c75c95dafa40', 'Audit completato con esito positivo. Nessuna non conformita rilevata.', NOW() - INTERVAL '7 days')
ON CONFLICT DO NOTHING;


COMMIT;

-- =============================================================================
-- RIEPILOGO DATI SEED
-- =============================================================================
--
-- CLIENTI (5):
--   C1: Acciaio Forte Spa         — Milano, EA 17, 250 dip
--   C2: TransLog Italia Srl       — Roma, EA 31, 85 dip
--   C3: Edilizia Verde Sas        — Napoli, EA 28, 18 dip
--   C4: Studio Ingegneria Conti   — Firenze, EA 34, 12 dip
--   C5: Coop Solidale Onlus       — Torino, EA 38, 45 dip
--
-- CONSULENTI (3):
--   K1: Antonio Marino   — ISO 9001, ISO 14001
--   K2: Stefania Conti   — ISO 45001, SA 8000, PDR 125/2022
--   K3: Roberto Ferri    — ISO 50001, ISO 14064-1, ESG-EASI
--
-- PRATICHE (8):
--   P1: Acciaio Forte  | ISO 9001     | Certificazione        | Fase 1 (Contratto)       | Operatore-A
--   P2: TransLog       | ISO 14001+45 | Prima Sorveglianza    | Fase 2 (Programmazione)  | Operatore-A
--   P3: Edilizia Verde | ISO 9001     | Certificazione        | Fase 3 (Proforma)        | Operatore-B
--   P4: Acciaio Forte  | ISO 14001    | Ricertificazione      | Fase 4 BLOCCATA          | Operatore-B
--   P5: Studio Conti   | PDR 125/2022 | Certificazione        | Fase 4 (sbloccata)       | Operatore-A
--   P6: Coop Solidale  | SA 8000      | Certificazione        | Fase 5 (Firme)           | Operatore-B
--   P7: TransLog       | ISO 9001     | Seconda Sorveglianza  | Completata               | Operatore-A
--   P8: Edilizia Verde | ISO 45001    | Certificazione        | Fase 2 SOSPESA           | Operatore-A
--
-- DISTRIBUZIONE PER OPERATORE (per test RLS):
--   Operatore-A: P1, P2, P5, P7, P8 = 5 pratiche
--   Operatore-B: P3, P4, P6 = 3 pratiche
--
-- PROMEMORIA (3): sollecito docs, prep audit, sorveglianza futura
-- MESSAGGI (4): conversazione su pratica P4 bloccata + richiesta P6
-- STORICO FASI: audit trail completo per P7 (5 transizioni)
-- =============================================================================
