-- =============================================================================
-- Migration 020 — Audit Integrati
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================
-- Introduce il concetto di "Audit Integrato": un CONTAINER che raggruppa
-- 2+ pratiche single-norma, ciascuna con workflow, operatore, scadenze e
-- allegati indipendenti.
--
-- Modello:
--   audit_integrati (1) ──< (N) pratiche
--     - 1 audit ha esattamente 1 cliente (denormalizzato per integrità)
--     - ogni pratica dell'audit ha 1 sola norma (enforced da trigger)
--     - SA 8000 NON può mai partecipare a un audit integrato (ciclo 36 mesi)
--     - l'audit è "completato" quando TUTTE le pratiche sono completate
--       (derivato → vw_audit_integrati, mai memorizzato)
--
-- Additività e retrocompatibilità:
--   - Tutte le colonne aggiunte a `pratiche` sono NULLable → pratiche esistenti
--     non sono toccate (diventano audit_integrato_id = NULL = stand-alone).
--   - I trigger esistenti (validate_fase_transition, protect_fase_flags,
--     log_cambio_fase) NON leggono le nuove colonne → nessun impatto.
--   - on_pratica_completata() viene riemessa con CREATE OR REPLACE:
--     mantiene logica identica a migration 019 + arricchisce il testo del
--     promemoria con "[Audit INTEGR-XXX — Cliente]" quando applicabile.
--     SECURITY DEFINER preservato da CREATE OR REPLACE (già verificato
--     sulla 019 che segue lo stesso pattern).
--   - Il trigger NUOVO validate_pratica_norma_audit() impedisce di AGGIUNGERE
--     righe pratiche_norme che violerebbero le regole ma NON tocca lo storico,
--     quindi eventuali pratiche legacy con N>1 norme continuano a esistere.
--
-- Sicurezza:
--   - RLS attiva su audit_integrati con 4 policy (SELECT/INSERT/UPDATE/DELETE).
--   - Operatore vede audit solo se ha almeno una pratica assegnata in esso.
--   - Trigger check_audit_cliente_coerenza impedisce cliente_id mismatch.
--   - CREATE OR REPLACE su on_pratica_completata preserva SECURITY DEFINER.
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1: TABELLA audit_integrati
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_integrati (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_audit TEXT UNIQUE, -- INTEGR-YYYY-NNNN (auto via trigger)
  cliente_id   UUID NOT NULL REFERENCES clienti(id),
  note         TEXT,
  -- Audit
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  created_by   UUID REFERENCES user_profiles(id),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   UUID REFERENCES user_profiles(id)
);

COMMENT ON TABLE audit_integrati IS
  'Container per raggruppare 2+ pratiche single-norma dello stesso cliente. '
  'Ciascuna pratica mantiene workflow, operatore, scadenze e allegati propri. '
  'Il completamento dell''audit è derivato (vw_audit_integrati.is_completato).';

COMMENT ON COLUMN audit_integrati.numero_audit IS
  'Auto-generato dal trigger set_numero_audit: INTEGR-YYYY-NNNN con '
  'advisory lock 2000+anno (disgiunto dal lock 1000+anno di pratiche).';

ALTER TABLE audit_integrati ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_integrati_cliente
  ON audit_integrati(cliente_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2: COLONNE SU pratiche
-- ═══════════════════════════════════════════════════════════════════════════
-- Additive, NULLable → zero impatto su righe esistenti.

ALTER TABLE pratiche
  ADD COLUMN IF NOT EXISTS audit_integrato_id UUID
    REFERENCES audit_integrati(id) ON DELETE SET NULL;

ALTER TABLE pratiche
  ADD COLUMN IF NOT EXISTS audit_progressivo SMALLINT;

COMMENT ON COLUMN pratiche.audit_integrato_id IS
  'Se NOT NULL, la pratica appartiene a un audit integrato. ON DELETE SET NULL '
  'per preservare le pratiche se l''admin dissolve il container audit.';

COMMENT ON COLUMN pratiche.audit_progressivo IS
  'Posizione 1..N della pratica nel proprio audit (per ordinamento stabile).';

CREATE INDEX IF NOT EXISTS idx_pratiche_audit_integrato_id
  ON pratiche(audit_integrato_id)
  WHERE audit_integrato_id IS NOT NULL;

-- Indice composito per la policy RLS SELECT su audit_integrati (EXISTS subquery)
CREATE INDEX IF NOT EXISTS idx_pratiche_audit_assegnato
  ON pratiche(audit_integrato_id, assegnato_a)
  WHERE audit_integrato_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 3: TRIGGER — genera_numero_audit (advisory lock 2000+anno)
-- ═══════════════════════════════════════════════════════════════════════════
-- Stesso pattern di genera_numero_pratica (migration 003) ma con:
--   - namespace numerazione: INTEGR-YYYY-NNNN
--   - advisory lock 2000+anno (pratiche usa 1000+anno → nessuna collisione)
-- WHEN (NEW.numero_audit IS NULL) → permette override manuale per import

CREATE OR REPLACE FUNCTION genera_numero_audit()
RETURNS TRIGGER AS $$
DECLARE
  anno INT := EXTRACT(YEAR FROM NOW());
  progressivo INT;
BEGIN
  PERFORM pg_advisory_xact_lock(2000 + anno);

  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(numero_audit, '-', 3) AS INT)
  ), 0) + 1 INTO progressivo
  FROM audit_integrati
  WHERE numero_audit LIKE 'INTEGR-' || anno || '-%';

  NEW.numero_audit := 'INTEGR-' || anno || '-' || LPAD(progressivo::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_numero_audit ON audit_integrati;
CREATE TRIGGER set_numero_audit
  BEFORE INSERT ON audit_integrati
  FOR EACH ROW
  WHEN (NEW.numero_audit IS NULL)
  EXECUTE FUNCTION genera_numero_audit();


-- Updated_at (riusa update_updated_at() già esistente in migration 003)
DROP TRIGGER IF EXISTS audit_integrati_updated_at ON audit_integrati;
CREATE TRIGGER audit_integrati_updated_at
  BEFORE UPDATE ON audit_integrati
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 4: TRIGGER — coerenza cliente_id pratica ↔ audit
-- ═══════════════════════════════════════════════════════════════════════════
-- Impedisce a una pratica con audit_integrato_id NOT NULL di avere un
-- cliente_id diverso da quello dell'audit container.
-- Fire su INSERT e su UPDATE di cliente_id/audit_integrato_id.

CREATE OR REPLACE FUNCTION check_audit_cliente_coerenza()
RETURNS TRIGGER AS $$
DECLARE
  audit_cliente UUID;
BEGIN
  IF NEW.audit_integrato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cliente_id INTO audit_cliente
  FROM audit_integrati
  WHERE id = NEW.audit_integrato_id;

  IF audit_cliente IS NULL THEN
    RAISE EXCEPTION 'Audit integrato % non trovato', NEW.audit_integrato_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF audit_cliente != NEW.cliente_id THEN
    RAISE EXCEPTION 'Il cliente della pratica (%) non corrisponde al cliente dell''audit integrato (%)',
      NEW.cliente_id, audit_cliente
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pratica_audit_cliente_coerenza ON pratiche;
CREATE TRIGGER pratica_audit_cliente_coerenza
  BEFORE INSERT OR UPDATE OF cliente_id, audit_integrato_id ON pratiche
  FOR EACH ROW
  EXECUTE FUNCTION check_audit_cliente_coerenza();


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 5: TRIGGER — validate_pratica_norma_audit
-- ═══════════════════════════════════════════════════════════════════════════
-- Enforce regole a livello pratiche_norme:
--   1) Una pratica NON in audit (audit_integrato_id IS NULL) deve avere al
--      massimo 1 norma. Previene la creazione di nuovi "audit fantasma"
--      (multi-norma senza container). Le pratiche legacy con N>1 norme
--      restano valide → il trigger è BEFORE INSERT, non valida lo storico.
--   2) SA 8000 NON può essere inserita su una pratica con audit_integrato_id
--      NOT NULL (ciclo 36 mesi, non compatibile con audit annuali).

CREATE OR REPLACE FUNCTION validate_pratica_norma_audit()
RETURNS TRIGGER AS $$
DECLARE
  aud_id     UUID;
  norme_cnt  INT;
BEGIN
  SELECT audit_integrato_id INTO aud_id
  FROM pratiche
  WHERE id = NEW.pratica_id;

  -- Regola 2: SA 8000 vietata negli audit integrati
  IF NEW.norma_codice = 'SA 8000' AND aud_id IS NOT NULL THEN
    RAISE EXCEPTION 'SA 8000 non può far parte di un audit integrato (ciclo 36 mesi)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Regola 1: solo 1 norma per pratica stand-alone (non in audit)
  IF aud_id IS NULL THEN
    SELECT COUNT(*) INTO norme_cnt
    FROM pratiche_norme
    WHERE pratica_id = NEW.pratica_id;

    IF norme_cnt >= 1 THEN
      RAISE EXCEPTION 'Una pratica stand-alone può avere una sola norma. Per 2+ norme usa un audit integrato.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pratiche_norme_audit_validate ON pratiche_norme;
CREATE TRIGGER pratiche_norme_audit_validate
  BEFORE INSERT ON pratiche_norme
  FOR EACH ROW
  EXECUTE FUNCTION validate_pratica_norma_audit();


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 6: AGGIORNAMENTO on_pratica_completata — testo promemoria arricchito
-- ═══════════════════════════════════════════════════════════════════════════
-- Base: versione migration 019 (con data_prossima_sorveglianza).
-- Delta: aggiunge suffisso "[Audit INTEGR-... — <cliente>]" al testo del
-- promemoria quando la pratica appartiene a un audit.
-- CREATE OR REPLACE preserva SECURITY DEFINER (già testato in 019).

CREATE OR REPLACE FUNCTION on_pratica_completata()
RETURNS TRIGGER AS $$
DECLARE
  giorni_scadenza INT := 365;
  norme_lista     TEXT;
  data_sorv       DATE;
  audit_suffix    TEXT := '';
  audit_numero    TEXT;
  cliente_label   TEXT;
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

    -- Calcolo unico → coerenza promemoria.data_scadenza ↔
    --   pratiche.data_prossima_sorveglianza.
    data_sorv := (NEW.completata_at + (giorni_scadenza || ' days')::INTERVAL)::DATE;

    -- Arricchimento audit: se la pratica è in un audit, prepariamo il suffisso
    IF NEW.audit_integrato_id IS NOT NULL THEN
      SELECT ai.numero_audit,
             COALESCE(c.nome, c.ragione_sociale, '?')
        INTO audit_numero, cliente_label
        FROM audit_integrati ai
        LEFT JOIN clienti c ON c.id = ai.cliente_id
       WHERE ai.id = NEW.audit_integrato_id;

      IF audit_numero IS NOT NULL THEN
        audit_suffix := ' [Audit ' || audit_numero || ' — ' || cliente_label || ']';
      END IF;
    END IF;

    INSERT INTO promemoria (pratica_id, creato_da, assegnato_a, testo, data_scadenza)
    VALUES (
      NEW.id,
      COALESCE(NEW.updated_by, NEW.created_by),
      NEW.assegnato_a,
      'Sorveglianza ' || COALESCE(norme_lista, '?') ||
        ' per pratica ' || NEW.numero_pratica || audit_suffix ||
        ' — verificare scadenza ciclo certificativo' ||
        CASE WHEN giorni_scadenza = 1095
          THEN ' (SA8000: ciclo 36 mesi)' ELSE '' END,
      data_sorv
    );

    NEW.data_prossima_sorveglianza := data_sorv;
    NEW.sorveglianza_reminder_creato := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 7: VIEW vw_audit_integrati — stato derivato
-- ═══════════════════════════════════════════════════════════════════════════
-- security_invoker = true → eredita le RLS di audit_integrati e pratiche.
-- Evita di duplicare logica di completamento/scadenza nel client.

CREATE OR REPLACE VIEW vw_audit_integrati
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.numero_audit,
  a.cliente_id,
  a.note,
  a.created_at,
  a.created_by,
  a.updated_at,
  a.updated_by,
  COUNT(p.id)::INT                                             AS pratiche_totali,
  COUNT(p.id) FILTER (WHERE p.fase = 'completata')::INT        AS pratiche_completate,
  (COUNT(p.id) > 0 AND
   COUNT(p.id) FILTER (WHERE p.fase != 'completata') = 0)      AS is_completato,
  COUNT(p.id) FILTER (WHERE p.stato = 'attiva')::INT           AS pratiche_attive,
  MIN(p.data_scadenza) FILTER (WHERE p.fase != 'completata')   AS prima_scadenza,
  MAX(p.data_scadenza) FILTER (WHERE p.fase != 'completata')   AS ultima_scadenza,
  BOOL_OR(p.archiviata)                                        AS ha_archiviate
FROM audit_integrati a
LEFT JOIN pratiche p ON p.audit_integrato_id = a.id
GROUP BY a.id;

COMMENT ON VIEW vw_audit_integrati IS
  'Stato derivato degli audit integrati: is_completato è true sse tutte le '
  'pratiche figlie hanno fase=completata. Eredita RLS con security_invoker.';

GRANT SELECT ON vw_audit_integrati TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 8: RLS POLICIES su audit_integrati
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: admin/responsabile vedono tutti; operatore vede solo audit in cui
--         ha almeno una pratica assegnata.
-- INSERT: admin/responsabile.
-- UPDATE: admin/responsabile.
-- DELETE: solo admin.

DROP POLICY IF EXISTS "audit_integrati_select" ON audit_integrati;
CREATE POLICY "audit_integrati_select"
  ON audit_integrati FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('admin', 'responsabile')
    OR EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.audit_integrato_id = audit_integrati.id
        AND p.assegnato_a = auth.uid()
    )
  );

DROP POLICY IF EXISTS "audit_integrati_insert" ON audit_integrati;
CREATE POLICY "audit_integrati_insert"
  ON audit_integrati FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'responsabile'));

DROP POLICY IF EXISTS "audit_integrati_update" ON audit_integrati;
CREATE POLICY "audit_integrati_update"
  ON audit_integrati FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'responsabile'))
  WITH CHECK (get_user_role() IN ('admin', 'responsabile'));

DROP POLICY IF EXISTS "audit_integrati_delete" ON audit_integrati;
CREATE POLICY "audit_integrati_delete"
  ON audit_integrati FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 9: Commenti finali
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION genera_numero_audit() IS
  'Genera INTEGR-YYYY-NNNN con advisory lock 2000+anno (disgiunto dal lock '
  'pratiche). Override manuale possibile via WHEN(NEW.numero_audit IS NULL).';

COMMENT ON FUNCTION check_audit_cliente_coerenza() IS
  'Garantisce invariante: una pratica in audit ha lo stesso cliente_id '
  'dell''audit container. Fire su INSERT e UPDATE di cliente_id/audit_integrato_id.';

COMMENT ON FUNCTION validate_pratica_norma_audit() IS
  'Enforce: (1) pratica stand-alone = max 1 norma; (2) SA 8000 vietata '
  'nelle pratiche di audit integrati (ciclo 36 mesi incompatibile).';
