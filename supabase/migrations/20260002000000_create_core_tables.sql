-- =============================================================================
-- Migration 002 — Core Tables
-- CertDesk: user_profiles, clienti, consulenti, norme_catalogo
-- Fonte di verità: DDL_RLS_schema.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- user_profiles — Profili utenti interni (legati a auth.users)
-- DDL: cognome nullable, NO updated_at
-- ---------------------------------------------------------------------------
CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cognome       TEXT,
  ruolo         user_role NOT NULL DEFAULT 'operatore',
  avatar_url    TEXT,
  attivo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Profili utenti interni del gestionale, collegati a auth.users';

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- clienti — Aziende clienti da certificare
-- ---------------------------------------------------------------------------
CREATE TABLE clienti (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  ragione_sociale TEXT,
  piva            TEXT,
  codice_fiscale  TEXT,
  email           TEXT,
  pec             TEXT,
  telefono        TEXT,
  indirizzo       TEXT,
  citta           TEXT,
  cap             TEXT,
  -- Campi dominio certificazione ISO
  codice_ea       TEXT,           -- codice EA dell'attività economica
  codice_nace     TEXT,           -- codice NACE/ATECO
  numero_dipendenti INT,         -- influenza durata audit ISO
  note            TEXT,
  attivo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID REFERENCES user_profiles(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE clienti IS 'Aziende clienti da certificare — codice_ea e codice_nace per classificazione settoriale';

ALTER TABLE clienti ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- consulenti — Consulenti esterni
-- DDL: cognome nullable, created_by presente, NO updated_at
-- ---------------------------------------------------------------------------
CREATE TABLE consulenti (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           TEXT NOT NULL,
  cognome        TEXT,
  email          TEXT,
  telefono       TEXT,
  azienda        TEXT,
  note           TEXT,
  attivo         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     UUID REFERENCES user_profiles(id)
);

COMMENT ON TABLE consulenti IS 'Consulenti esterni che supportano le aziende nella certificazione';

ALTER TABLE consulenti ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- norme_catalogo — 17 norme ISO gestite (dati di riferimento, fissi)
-- Creata qui (migration 002) perché le junction tables in migration 006
-- hanno FK verso norme_catalogo e devono trovarla già esistente.
-- ---------------------------------------------------------------------------
CREATE TABLE norme_catalogo (
  codice  TEXT PRIMARY KEY,
  nome    TEXT NOT NULL,
  ordine  INT DEFAULT 0
);

COMMENT ON TABLE norme_catalogo IS 'Catalogo norme ISO gestite — dati di riferimento, uguali per tutti i clienti';

ALTER TABLE norme_catalogo ENABLE ROW LEVEL SECURITY;

-- Popolamento norme ISO (DDL_RLS_schema.md — nomi estesi)
INSERT INTO norme_catalogo (codice, nome, ordine) VALUES
  ('ISO 9001',      'Sistemi di gestione della qualità (SGQ)',                                          1),
  ('ISO 14001',     'Sistemi di gestione ambientale (SGA)',                                             2),
  ('ISO 45001',     'Sistemi di gestione della salute e sicurezza sul lavoro (SGSL)',                   3),
  ('SA 8000',       'Responsabilità sociale d''impresa',                                                4),
  ('PAS 24000',     'Sistema di gestione sociale (SMS) e prestazioni sociali',                          5),
  ('PDR 125/2022',  'Sistema di gestione per la parità di genere',                                      6),
  ('ESG-EASI',      'Criteri di sostenibilità e responsabilità sociale d''impresa',                     7),
  ('ISO 37001',     'Sistemi di gestione anti-corruzione',                                              8),
  ('ISO 39001',     'Sistemi di gestione della sicurezza stradale (RGMS)',                              9),
  ('ISO 50001',     'Sistemi di gestione dell''energia (SGE)',                                         10),
  ('ISO 27001',     'Sistemi di gestione della sicurezza delle informazioni (SGSI)',                   11),
  ('ISO 14064-1',   'Quantificazione e rendicontazione delle emissioni di gas serra',                  12),
  ('ISO 30415',     'Gestione delle risorse umane per la diversità e l''inclusione',                   13),
  ('ISO 13009',     'Requisiti e raccomandazioni per gli operatori di spiaggia',                       14),
  ('ISO 20121',     'Sistemi di gestione della sostenibilità per gli eventi',                          15),
  ('EN 1090',       'Requisiti tecnici per la fabbricazione di strutture in acciaio e alluminio',      16),
  ('ISO 3834',      'Requisiti di qualità per la saldatura per fusione di materiali metallici',        17);
