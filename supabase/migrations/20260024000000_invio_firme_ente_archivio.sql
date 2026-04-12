-- =============================================================================
-- Migration 024 — Fase invio_firme, ente certificazione, nota archiviazione
--
-- Prerequisiti: migration 023 (ALTER TYPE fase_type ADD VALUE 'invio_firme')
--
-- Contenuto:
--   A) Campo firme_inviate su pratiche (prerequisito invio_firme → completata)
--   B) Enum + campo ente_certificazione su pratiche
--   C) Campo nota_archiviazione su clienti e consulenti
--   D) Aggiorna validate_fase_transition (7 fasi + prerequisito firme_inviate)
--   E) Aggiorna protect_fase_flags (7 fasi + protezione firme_inviate)
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- A) Campo firme_inviate — prerequisito per invio_firme → completata
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pratiche ADD COLUMN IF NOT EXISTS firme_inviate BOOLEAN DEFAULT false;


-- ═══════════════════════════════════════════════════════════════════════════
-- B) Ente di certificazione
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE ente_certificazione_type AS ENUM ('ESQ', 'CERTIS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE pratiche ADD COLUMN IF NOT EXISTS ente_certificazione ente_certificazione_type NOT NULL DEFAULT 'ESQ';


-- ═══════════════════════════════════════════════════════════════════════════
-- C) Nota archiviazione per clienti e consulenti
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE clienti ADD COLUMN IF NOT EXISTS nota_archiviazione TEXT;
ALTER TABLE consulenti ADD COLUMN IF NOT EXISTS nota_archiviazione TEXT;


-- ═══════════════════════════════════════════════════════════════════════════
-- D) validate_fase_transition — aggiornata a 7 fasi
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_fase_transition()
RETURNS TRIGGER AS $$
DECLARE
  fasi_ordine TEXT[] := ARRAY[
    'contratto_firmato','programmazione_verifica',
    'richiesta_proforma','elaborazione_pratica',
    'firme','invio_firme','completata'
  ];
  old_idx INT;
  new_idx INT;
BEGIN
  -- Se la fase non è cambiata, non fare nulla
  IF OLD.fase = NEW.fase THEN RETURN NEW; END IF;

  -- Se la pratica non è attiva, non permettere avanzamento
  IF NEW.stato != 'attiva' THEN
    RAISE EXCEPTION 'Impossibile cambiare fase: la pratica è in stato %', NEW.stato;
  END IF;

  old_idx := array_position(fasi_ordine, OLD.fase::TEXT);
  new_idx := array_position(fasi_ordine, NEW.fase::TEXT);

  -- Solo avanzamento di 1 step o retrocessione di 1 step
  IF new_idx - old_idx > 1 THEN
    RAISE EXCEPTION 'Non è possibile saltare fasi: da % a %', OLD.fase, NEW.fase;
  END IF;
  IF old_idx - new_idx > 1 THEN
    RAISE EXCEPTION 'Retrocessione massima di una fase: da % a %', OLD.fase, NEW.fase;
  END IF;

  -- Prerequisiti per avanzamento
  IF new_idx > old_idx THEN
    CASE NEW.fase::TEXT
      WHEN 'programmazione_verifica' THEN
        NULL; -- nessun prerequisito
      WHEN 'richiesta_proforma' THEN
        IF NEW.data_verifica IS NULL THEN
          RAISE EXCEPTION 'Data verifica obbligatoria per avanzare a Richiesta Proforma';
        END IF;
      WHEN 'elaborazione_pratica' THEN
        IF NOT COALESCE(NEW.proforma_emessa, false) THEN
          RAISE EXCEPTION 'Proforma deve essere emessa per avanzare a Elaborazione Pratica';
        END IF;
      WHEN 'firme' THEN
        IF NOT COALESCE(NEW.documenti_ricevuti, false) THEN
          RAISE EXCEPTION 'Documenti devono essere ricevuti per avanzare a Firme';
        END IF;
      WHEN 'invio_firme' THEN
        NULL; -- nessun prerequisito (da firme a invio_firme)
      WHEN 'completata' THEN
        IF NOT COALESCE(NEW.firme_inviate, false) THEN
          RAISE EXCEPTION 'Le firme devono essere inviate per completare la pratica';
        END IF;
    END CASE;
  END IF;

  -- Se si passa a completata: auto-set campi completamento
  IF NEW.fase = 'completata' AND OLD.fase != 'completata' THEN
    NEW.completata := true;
    NEW.completata_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- E) protect_fase_flags — aggiornata a 7 fasi + protezione firme_inviate
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION protect_fase_flags()
RETURNS TRIGGER AS $$
DECLARE
  fasi_ordine TEXT[] := ARRAY[
    'contratto_firmato','programmazione_verifica',
    'richiesta_proforma','elaborazione_pratica',
    'firme','invio_firme','completata'
  ];
  fase_idx INT;
BEGIN
  fase_idx := array_position(fasi_ordine, NEW.fase::TEXT);

  -- Se siamo oltre richiesta_proforma, proforma_emessa non può tornare false
  IF fase_idx >= 4 -- elaborazione_pratica o oltre
     AND OLD.proforma_emessa = true
     AND NEW.proforma_emessa = false THEN
    RAISE EXCEPTION 'Non è possibile resettare proforma_emessa in fase %', NEW.fase;
  END IF;

  -- Se siamo oltre elaborazione_pratica, documenti_ricevuti non può tornare false
  IF fase_idx >= 5 -- firme o oltre
     AND OLD.documenti_ricevuti = true
     AND NEW.documenti_ricevuti = false THEN
    RAISE EXCEPTION 'Non è possibile resettare documenti_ricevuti in fase %', NEW.fase;
  END IF;

  -- Se siamo oltre invio_firme, firme_inviate non può tornare false
  IF fase_idx >= 7 -- completata
     AND OLD.firme_inviate = true
     AND NEW.firme_inviate = false THEN
    RAISE EXCEPTION 'Non è possibile resettare firme_inviate in fase %', NEW.fase;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
