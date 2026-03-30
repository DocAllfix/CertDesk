-- =============================================================================
-- Migration 006 — Tabelle di Giunzione Norme + Trigger Workflow
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE A: Tabelle di giunzione con FK ON UPDATE CASCADE
-- ═══════════════════════════════════════════════════════════════════════════

-- pratiche_norme — Norme ISO associate ad ogni pratica
CREATE TABLE pratiche_norme (
  pratica_id   UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
  norma_codice TEXT NOT NULL REFERENCES norme_catalogo(codice) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (pratica_id, norma_codice)
);

ALTER TABLE pratiche_norme ENABLE ROW LEVEL SECURITY;

-- responsabili_norme — Quali norme ISO gestisce ogni responsabile
CREATE TABLE responsabili_norme (
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  norma_codice TEXT NOT NULL REFERENCES norme_catalogo(codice) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (user_id, norma_codice)
);

ALTER TABLE responsabili_norme ENABLE ROW LEVEL SECURITY;

-- consulenti_norme — Quali norme ISO copre ogni consulente esterno
CREATE TABLE consulenti_norme (
  consulente_id UUID NOT NULL REFERENCES consulenti(id) ON DELETE CASCADE,
  norma_codice  TEXT NOT NULL REFERENCES norme_catalogo(codice) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (consulente_id, norma_codice)
);

ALTER TABLE consulenti_norme ENABLE ROW LEVEL SECURITY;

-- Indici per query inverse (da norma → entità)
CREATE INDEX idx_pratiche_norme_norma ON pratiche_norme(norma_codice);
CREATE INDEX idx_responsabili_norme_norma ON responsabili_norme(norma_codice);
CREATE INDEX idx_consulenti_norme_norma ON consulenti_norme(norma_codice);


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE B: validate_fase_transition
-- BEFORE UPDATE OF fase — valida prerequisiti, impedisce salto >1 step,
-- permette retrocessione di massimo 1 step, blocca se stato != 'attiva',
-- auto-set completata/completata_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validate_fase_transition()
RETURNS TRIGGER AS $$
DECLARE
  fasi_ordine TEXT[] := ARRAY[
    'contratto_firmato','programmazione_verifica',
    'richiesta_proforma','elaborazione_pratica','firme','completata'
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
      WHEN 'completata' THEN
        NULL; -- da firme a completata nessun prerequisito aggiuntivo
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

CREATE TRIGGER check_fase_transition
  BEFORE UPDATE OF fase ON pratiche
  FOR EACH ROW
  EXECUTE FUNCTION validate_fase_transition();


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE C: protect_fase_flags
-- BEFORE UPDATE — impedisce reset di flag già superati
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION protect_fase_flags()
RETURNS TRIGGER AS $$
DECLARE
  fasi_ordine TEXT[] := ARRAY[
    'contratto_firmato','programmazione_verifica',
    'richiesta_proforma','elaborazione_pratica','firme','completata'
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_fase_flags
  BEFORE UPDATE ON pratiche
  FOR EACH ROW
  EXECUTE FUNCTION protect_fase_flags();


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE D: on_pratica_completata
-- BEFORE UPDATE OF fase — crea promemoria sorveglianza +365gg
-- dalla data di completamento, nella stessa transazione
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION on_pratica_completata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fase = 'completata' AND OLD.fase != 'completata'
     AND NOT COALESCE(NEW.sorveglianza_reminder_creato, false) THEN

    INSERT INTO promemoria (pratica_id, creato_da, assegnato_a, testo, data_scadenza)
    VALUES (
      NEW.id,
      COALESCE(NEW.updated_by, NEW.created_by),
      NEW.assegnato_a,
      'Sorveglianza ' || (
        SELECT string_agg(norma_codice, ' + ' ORDER BY norma_codice)
        FROM pratiche_norme WHERE pratica_id = NEW.id
      ) ||
        ' per pratica ' || NEW.numero_pratica ||
        ' — verificare scadenza ciclo certificativo',
      (NEW.completata_at + INTERVAL '365 days')::DATE
    );

    NEW.sorveglianza_reminder_creato := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pratica_completata_reminder
  BEFORE UPDATE OF fase ON pratiche
  FOR EACH ROW
  EXECUTE FUNCTION on_pratica_completata();


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE E: log_cambio_fase
-- AFTER UPDATE OF fase — scrive in storico_fasi
-- AFTER perché deve eseguirsi solo se la validazione ha avuto successo
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_cambio_fase()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.fase IS DISTINCT FROM NEW.fase THEN
    INSERT INTO storico_fasi (pratica_id, fase_precedente, fase_nuova, cambiato_da)
    VALUES (NEW.id, OLD.fase, NEW.fase, COALESCE(NEW.updated_by, auth.uid()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTA: AFTER UPDATE perché il BEFORE è occupato dalla validazione.
-- Lo storico si scrive solo se l'update ha successo.
CREATE TRIGGER log_fase_change
  AFTER UPDATE OF fase ON pratiche
  FOR EACH ROW
  EXECUTE FUNCTION log_cambio_fase();


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE F: crea_notifica — Function helper SECURITY DEFINER
-- DDL: 6 parametri, p_mittente_id esplicito (non auth.uid() interno)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION crea_notifica(
  p_destinatario_id UUID,
  p_pratica_id UUID,
  p_tipo notifica_tipo,
  p_titolo TEXT,
  p_messaggio TEXT,
  p_mittente_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO notifiche (destinatario_id, mittente_id, pratica_id, tipo, titolo, messaggio)
  VALUES (p_destinatario_id, p_mittente_id, p_pratica_id, p_tipo, p_titolo, p_messaggio)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Protezione: solo utenti autenticati possono chiamare crea_notifica
REVOKE ALL ON FUNCTION crea_notifica FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crea_notifica TO authenticated;
