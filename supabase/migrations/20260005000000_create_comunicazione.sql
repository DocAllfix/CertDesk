-- =============================================================================
-- Migration 005 — Comunicazione
-- CertDesk: notifiche, messaggi interni, promemoria
-- Fonte di verità: DDL_RLS_schema.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- notifiche — Notifiche interne per utente (NO email esterne)
-- DDL: pratica_id ON DELETE CASCADE, messaggio NOT NULL
-- ---------------------------------------------------------------------------
CREATE TABLE notifiche (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  mittente_id      UUID REFERENCES user_profiles(id),
  pratica_id       UUID REFERENCES pratiche(id) ON DELETE CASCADE,
  tipo             notifica_tipo NOT NULL DEFAULT 'info',
  titolo           TEXT NOT NULL,
  messaggio        TEXT NOT NULL,
  letta            BOOLEAN DEFAULT false,
  letta_at         TIMESTAMPTZ,
  azione_url       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notifiche IS 'Notifiche interne al gestionale — nessuna email esterna';

ALTER TABLE notifiche ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- messaggi_interni — Feed comunicazione per pratica
-- ---------------------------------------------------------------------------
CREATE TABLE messaggi_interni (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pratica_id       UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
  autore_id        UUID NOT NULL REFERENCES user_profiles(id),
  destinatario_id  UUID REFERENCES user_profiles(id),
  tipo             messaggio_tipo NOT NULL DEFAULT 'commento',
  testo            TEXT NOT NULL,
  allegato_id      UUID REFERENCES allegati(id),
  letto_da         UUID[] DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE messaggi_interni IS 'Feed di comunicazione interna per ogni pratica';
COMMENT ON COLUMN messaggi_interni.destinatario_id IS 'NULL = messaggio visibile a tutti';
COMMENT ON COLUMN messaggi_interni.letto_da IS 'Array UUID — no FK, accettabile per 5 utenti';

ALTER TABLE messaggi_interni ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- promemoria — Task e reminder per pratiche o globali
-- DDL: NO updated_at, NO updated_at trigger
-- ---------------------------------------------------------------------------
CREATE TABLE promemoria (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pratica_id       UUID REFERENCES pratiche(id) ON DELETE CASCADE,
  creato_da        UUID NOT NULL REFERENCES user_profiles(id),
  assegnato_a      UUID REFERENCES user_profiles(id),
  testo            TEXT NOT NULL,
  data_scadenza    DATE,
  completato       BOOLEAN DEFAULT false,
  completato_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE promemoria IS 'Promemoria/task — pratica_id NULL = promemoria globale';

ALTER TABLE promemoria ENABLE ROW LEVEL SECURITY;
