-- =============================================================================
-- Migration 003 — Pratiche (entità centrale) + Trigger numero pratica + updated_at
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- pratiche — Entità centrale del gestionale
-- ---------------------------------------------------------------------------
CREATE TABLE pratiche (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pratica           TEXT UNIQUE, -- CERT-2026-0001 (auto via trigger)
  cliente_id               UUID NOT NULL REFERENCES clienti(id),
  ciclo                    ciclo_type NOT NULL,
  fase                     fase_type NOT NULL DEFAULT 'contratto_firmato',
  stato                    stato_pratica_type NOT NULL DEFAULT 'attiva',
  assegnato_a              UUID REFERENCES user_profiles(id),
  tipo_contatto            contatto_type NOT NULL DEFAULT 'consulente',
  consulente_id            UUID REFERENCES consulenti(id),
  referente_nome           TEXT,
  referente_email          TEXT,
  referente_tel            TEXT,
  -- Fase 2: Programmazione Verifica
  data_verifica            DATE,
  auditor_id               UUID REFERENCES user_profiles(id),
  sede_verifica            TEXT,
  -- Fase 3: Proforma
  proforma_richiesta       BOOLEAN DEFAULT false,
  proforma_emessa          BOOLEAN DEFAULT false,
  proforma_richiesta_at    TIMESTAMPTZ,
  proforma_emessa_at       TIMESTAMPTZ,
  -- Fase 4: Documenti
  documenti_ricevuti       BOOLEAN DEFAULT false,
  documenti_ricevuti_at    TIMESTAMPTZ,
  -- Completamento e Certificato
  data_scadenza            DATE,
  completata               BOOLEAN DEFAULT false,
  completata_at            TIMESTAMPTZ,
  numero_certificato       TEXT,              -- numero del certificato emesso
  data_emissione_certificato DATE,            -- data emissione certificato
  data_scadenza_certificato  DATE,            -- scadenza certificato (tipicamente 3 anni)
  -- Generale
  note                     TEXT,
  priorita                 INT DEFAULT 0, -- 0=normale, 1=alta, 2=urgente
  archiviata               BOOLEAN DEFAULT false,
  sorveglianza_reminder_creato BOOLEAN DEFAULT false,
  -- Stato pratica (sospensione/annullamento)
  motivo_stato             TEXT,              -- motivazione per sospensione/annullamento
  stato_cambiato_at        TIMESTAMPTZ,       -- quando è stato cambiato lo stato
  stato_cambiato_da        UUID REFERENCES user_profiles(id), -- chi ha cambiato lo stato
  -- Audit
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  created_by               UUID REFERENCES user_profiles(id),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_by               UUID REFERENCES user_profiles(id)
);

COMMENT ON TABLE pratiche IS 'Entità centrale: ogni pratica rappresenta un ciclo di certificazione ISO per un cliente';
COMMENT ON COLUMN pratiche.numero_pratica IS 'Auto-generato dal trigger: CERT-YYYY-NNNN con advisory lock';
COMMENT ON COLUMN pratiche.priorita IS '0=normale, 1=alta, 2=urgente';

ALTER TABLE pratiche ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TRIGGER: Auto-genera numero_pratica (RACE-CONDITION SAFE)
-- Usa pg_advisory_xact_lock per serializzare inserimenti concorrenti.
-- Il lock si rilascia automaticamente al commit/rollback.
-- WHEN (NEW.numero_pratica IS NULL) → permette override manuale per import dati
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION genera_numero_pratica()
RETURNS TRIGGER AS $$
DECLARE
  anno INT := EXTRACT(YEAR FROM NOW());
  progressivo INT;
BEGIN
  -- Lock advisory per serializzare generazione numero nello stesso anno
  -- Usa un ID fisso deterministico (nessun rischio collisione hash)
  PERFORM pg_advisory_xact_lock(1000 + anno);

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(numero_pratica, '-', 3) AS INT)
  ), 0) + 1 INTO progressivo
  FROM pratiche
  WHERE numero_pratica LIKE 'CERT-' || anno || '-%';

  NEW.numero_pratica := 'CERT-' || anno || '-' || LPAD(progressivo::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_numero_pratica
  BEFORE INSERT ON pratiche
  FOR EACH ROW
  WHEN (NEW.numero_pratica IS NULL)
  EXECUTE FUNCTION genera_numero_pratica();

-- ---------------------------------------------------------------------------
-- TRIGGER: Auto-aggiorna updated_at
-- Applicato a pratiche e clienti
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pratiche_updated_at
  BEFORE UPDATE ON pratiche
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clienti_updated_at
  BEFORE UPDATE ON clienti
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
