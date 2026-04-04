-- =============================================================================
-- Migration 012 — Preparazione SA8000 + Escalation Scadenze
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================
-- Questa migration è ADDITIVA e NON DISTRUTTIVA:
--   - Aggiunge valori all'enum ciclo_type (IF NOT EXISTS)
--   - Crea una nuova tabella (IF NOT EXISTS)
--   - Sostituisce on_pratica_completata() con CREATE OR REPLACE (no drop)
-- Il trigger pratica_completata_reminder esiste già e non viene ricreato.
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1: ESTENSIONE ciclo_type PER SA8000
-- ═══════════════════════════════════════════════════════════════════════════
-- SA8000 ha un ciclo triennale: sorveglianze semestrali, follow-up remoti,
-- ricertificazione al 30° mese. Aggiungiamo i valori ora per evitare
-- ALTER TYPE dopo il deploy in produzione.

ALTER TYPE ciclo_type ADD VALUE IF NOT EXISTS 'terza_sorveglianza';
ALTER TYPE ciclo_type ADD VALUE IF NOT EXISTS 'quarta_sorveglianza';
ALTER TYPE ciclo_type ADD VALUE IF NOT EXISTS 'follow_up_review';
ALTER TYPE ciclo_type ADD VALUE IF NOT EXISTS 'ricertificazione_30m';

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2: TABELLA TRACCIAMENTO ESCALATION SCADENZE
-- ═══════════════════════════════════════════════════════════════════════════
-- Traccia quali notifiche di escalation sono già state inviate per ogni
-- pratica, evitando duplicati se il cron viene rieseguito nella stessa
-- finestra temporale.
-- Il cron giornaliero (F11.2) la usa per sapere se la notifica a
-- 60gg, 30gg, 14gg, 7gg, 1gg è già stata inviata.
--
-- NOTA ACCESSO:
--   - Scrittura: solo via Edge Function con service_role (bypassa RLS)
--   - Lettura:   solo admin autenticato (monitoraggio/debug)

CREATE TABLE IF NOT EXISTS notifiche_scadenza_inviate (
  pratica_id    UUID NOT NULL REFERENCES pratiche(id) ON DELETE CASCADE,
  giorni_soglia INT NOT NULL, -- 60, 30, 14, 7, 1
  inviata_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pratica_id, giorni_soglia)
);

CREATE INDEX IF NOT EXISTS idx_notifiche_scadenza_pratica
  ON notifiche_scadenza_inviate(pratica_id);

-- RLS obbligatoria per ogni tabella (regola progetto)
ALTER TABLE notifiche_scadenza_inviate ENABLE ROW LEVEL SECURITY;

-- Lettura per admin (debug/monitoraggio). Il cron usa service_role → bypassa RLS.
CREATE POLICY "Admin lettura escalation inviate"
  ON notifiche_scadenza_inviate FOR SELECT
  TO authenticated
  USING (get_user_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 3: TRIGGER SCADENZA PARAMETRICA (SA8000 = 36 mesi, altre = 12 mesi)
-- ═══════════════════════════════════════════════════════════════════════════
-- Sostituisce on_pratica_completata() con CREATE OR REPLACE.
-- Il trigger pratica_completata_reminder viene riutilizzato automaticamente
-- (PostgreSQL aggiorna la funzione in-place senza toccare il trigger).
--
-- Logica:
--   - Pratica con norma 'SA 8000' → promemoria sorveglianza a +1095 giorni (36 mesi)
--   - Qualsiasi altra pratica   → promemoria sorveglianza a +365 giorni (12 mesi)
--   - COALESCE(norme_lista, '?') protegge da pratiche senza norme (testo NOT NULL)
--   - Il guard sorveglianza_reminder_creato previene duplicati su re-trigger

CREATE OR REPLACE FUNCTION on_pratica_completata()
RETURNS TRIGGER AS $$
DECLARE
  giorni_scadenza INT := 365;
  norme_lista     TEXT;
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
      (NEW.completata_at + (giorni_scadenza || ' days')::INTERVAL)::DATE
    );

    NEW.sorveglianza_reminder_creato := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Il trigger pratica_completata_reminder esiste già: punta alla funzione
-- aggiornata automaticamente tramite CREATE OR REPLACE (nessun DROP/CREATE).
