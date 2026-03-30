-- =============================================================================
-- Migration 004 — Allegati e Storico Fasi
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- allegati — File caricati nelle pratiche (referenzia Supabase Storage)
-- DDL: mime_type, dimensione_bytes, caricato_da sono NULLABLE
-- ---------------------------------------------------------------------------
CREATE TABLE allegati (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pratica_id       UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
  nome_file        TEXT NOT NULL,
  nome_originale   TEXT NOT NULL,
  storage_path     TEXT NOT NULL,
  mime_type        TEXT,
  dimensione_bytes BIGINT,
  fase_riferimento fase_type,
  descrizione      TEXT,
  caricato_da      UUID REFERENCES user_profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE allegati IS 'File allegati alle pratiche — storage_path punta al bucket Supabase allegati-pratiche';

ALTER TABLE allegati ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- storico_fasi — Audit trail immutabile dei cambi fase (SOLO INSERT)
-- DDL: fase_precedente è NULLABLE (primo inserimento può non avere precedente)
-- ---------------------------------------------------------------------------
CREATE TABLE storico_fasi (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pratica_id       UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
  fase_precedente  fase_type,
  fase_nuova       fase_type NOT NULL,
  cambiato_da      UUID REFERENCES user_profiles(id),
  motivo           TEXT,
  dati_aggiuntivi  JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE storico_fasi IS 'Audit log immutabile: ogni cambio fase viene registrato. Solo INSERT consentiti.';

ALTER TABLE storico_fasi ENABLE ROW LEVEL SECURITY;
