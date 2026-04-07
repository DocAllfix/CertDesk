-- =============================================================================
-- Migration 019 — data_prossima_sorveglianza su pratiche
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================
-- Aggiunge una colonna derivata `data_prossima_sorveglianza` sulla tabella
-- pratiche, popolata automaticamente dal trigger on_pratica_completata con la
-- stessa formula del promemoria sorveglianza:
--   - SA 8000  → +1095 giorni (36 mesi) dal completamento
--   - altre    → +365  giorni (12 mesi) dal completamento
--
-- Motivazione:
--   - Permette di mostrare la prossima sorveglianza nella tab "Completate" e
--     nell'archivio senza JOIN ai promemoria.
--   - Permette ordinamento/filtro a livello SQL (indicizzata).
--   - Semanticamente distinta da `data_scadenza_certificato` (3 anni) e
--     `data_scadenza` (scadenza pianificata della pratica corrente).
--
-- Sicurezza/coerenza:
--   - Migration ADDITIVA: aggiunge colonna + indice + sostituisce funzione.
--   - Il trigger `pratica_completata_reminder` esiste già: la sostituzione
--     della funzione via CREATE OR REPLACE non lo tocca.
--   - Backfill one-shot per le pratiche già completate.
--   - Il guard `sorveglianza_reminder_creato` continua a prevenire duplicati
--     anche per la nuova colonna (stessa logica del promemoria).
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1: COLONNA + INDICE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pratiche
  ADD COLUMN IF NOT EXISTS data_prossima_sorveglianza DATE;

COMMENT ON COLUMN pratiche.data_prossima_sorveglianza IS
  'Data della prossima sorveglianza, calcolata da on_pratica_completata() come '
  'completata_at + 365gg (1095gg per pratiche con SA 8000). '
  'Distinta da data_scadenza_certificato (scadenza certificato 3 anni) e '
  'data_scadenza (scadenza pianificata pratica corrente).';

CREATE INDEX IF NOT EXISTS idx_pratiche_data_prossima_sorveglianza
  ON pratiche (data_prossima_sorveglianza)
  WHERE data_prossima_sorveglianza IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2: AGGIORNAMENTO TRIGGER on_pratica_completata
-- ═══════════════════════════════════════════════════════════════════════════
-- CREATE OR REPLACE: il trigger pratica_completata_reminder esiste già e
-- continua a puntare a questa funzione (PostgreSQL aggiorna in-place).
-- Differenza rispetto alla versione 012: aggiunge il set di
-- NEW.data_prossima_sorveglianza con la stessa formula del promemoria.
-- Calcoliamo la data UNA volta sola in una variabile per garantire che
-- promemoria e colonna restino bit-identici.

CREATE OR REPLACE FUNCTION on_pratica_completata()
RETURNS TRIGGER AS $$
DECLARE
  giorni_scadenza INT := 365;
  norme_lista     TEXT;
  data_sorv       DATE;
BEGIN
  IF NEW.fase = 'completata' AND OLD.fase != 'completata'
     AND NOT COALESCE(NEW.sorveglianza_reminder_creato, false) THEN

    -- Verifica se la pratica include SA 8000 → scadenza 36 mesi
    IF EXISTS (
      SELECT 1 FROM pratiche_norme
      WHERE pratica_id = NEW.id AND norma_codice = 'SA 8000'
    ) THEN
      giorni_scadenza := 1095; -- 36 mesi
    END IF;

    -- Recupera lista norme per il testo del promemoria
    SELECT string_agg(norma_codice, ' + ' ORDER BY norma_codice)
    INTO norme_lista
    FROM pratiche_norme WHERE pratica_id = NEW.id;

    -- Calcolo unico → garantisce coerenza fra promemoria.data_scadenza e
    -- pratiche.data_prossima_sorveglianza.
    data_sorv := (NEW.completata_at + (giorni_scadenza || ' days')::INTERVAL)::DATE;

    INSERT INTO promemoria (pratica_id, creato_da, assegnato_a, testo, data_scadenza)
    VALUES (
      NEW.id,
      COALESCE(NEW.updated_by, NEW.created_by),
      NEW.assegnato_a,
      'Sorveglianza ' || COALESCE(norme_lista, '?') ||
        ' per pratica ' || NEW.numero_pratica ||
        ' — verificare scadenza ciclo certificativo' ||
        CASE WHEN giorni_scadenza = 1095
          THEN ' (SA8000: ciclo 36 mesi)' ELSE '' END,
      data_sorv
    );

    -- Popoliamo la nuova colonna sulla pratica.
    -- BEFORE UPDATE: NEW := mutato → l'UPDATE che ha scatenato il trigger
    -- scriverà anche questo valore.
    NEW.data_prossima_sorveglianza := data_sorv;

    NEW.sorveglianza_reminder_creato := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 3: BACKFILL PER PRATICHE GIÀ COMPLETATE
-- ═══════════════════════════════════════════════════════════════════════════
-- Idempotente: aggiorna solo righe completate con completata_at NOT NULL e
-- data_prossima_sorveglianza ancora NULL. Stessa formula del trigger.
-- Eseguito UNA volta sola; se la migration viene rieseguita non fa danno
-- perché il filtro WHERE esclude le righe già backfillate.

UPDATE pratiche p
   SET data_prossima_sorveglianza = (
         p.completata_at +
         (CASE
            WHEN EXISTS (
              SELECT 1 FROM pratiche_norme pn
               WHERE pn.pratica_id = p.id
                 AND pn.norma_codice = 'SA 8000'
            ) THEN INTERVAL '1095 days'
            ELSE INTERVAL '365 days'
          END)
       )::DATE
 WHERE p.fase = 'completata'
   AND p.completata_at IS NOT NULL
   AND p.data_prossima_sorveglianza IS NULL;
