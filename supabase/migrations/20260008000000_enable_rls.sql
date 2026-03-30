-- =============================================================================
-- Migration 008 — RLS Policies Complete
-- CertDesk — Progettato da Antigravity Opus in F1.2-AG
-- Fonte di verità: DDL_RLS_schema.md + certdesk-piano-definitivo-v2.2.md
--
-- NOTA: ALTER TABLE ... ENABLE ROW LEVEL SECURITY già eseguito nelle
-- migration 002-006. Qui si creano SOLO le policies + fix funzioni.
--
-- Totale: 37 policies su 13 tabelle
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 0: Trigger functions → SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════════════
-- log_cambio_fase() inserisce in storico_fasi. Senza SECURITY DEFINER,
-- gira come l'utente che ha fatto l'UPDATE, che NON ha INSERT policy
-- su storico_fasi (immutabile per design). SECURITY DEFINER bypassa RLS.
ALTER FUNCTION log_cambio_fase() SECURITY DEFINER;

-- on_pratica_completata() inserisce in promemoria. Il promemoria è
-- generato dal sistema, non dall'utente. SECURITY DEFINER garantisce
-- che l'INSERT avvenga anche se l'utente non ha accesso diretto.
ALTER FUNCTION on_pratica_completata() SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1: get_user_role() — già creata in migration 007, ricreata qui
-- per sicurezza con CREATE OR REPLACE + REVOKE/GRANT espliciti
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT ruolo FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2: Fix get_statistiche_dashboard() — Sicurezza parametro
-- ═══════════════════════════════════════════════════════════════════════════
-- PROBLEMA: un operatore potrebbe chiamare get_statistiche_dashboard(NULL)
-- e ottenere conteggi globali. FIX: forzare p_user_id = auth.uid() per operatore.
CREATE OR REPLACE FUNCTION get_statistiche_dashboard(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_effective_user_id UUID;
BEGIN
  -- SECURITY: operatore può vedere solo le proprie statistiche
  IF get_user_role() = 'operatore' THEN
    v_effective_user_id := auth.uid();
  ELSE
    v_effective_user_id := p_user_id;
  END IF;

  SELECT json_build_object(
    'totale_attive', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND archiviata = false
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'per_fase', COALESCE((
      SELECT json_object_agg(fase, cnt) FROM (
        SELECT fase::TEXT, COUNT(*) AS cnt FROM pratiche
        WHERE stato = 'attiva' AND archiviata = false
          AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
        GROUP BY fase
      ) sub
    ), '{}'::JSON),
    'per_ciclo', COALESCE((
      SELECT json_object_agg(ciclo, cnt) FROM (
        SELECT ciclo::TEXT, COUNT(*) AS cnt FROM pratiche
        WHERE stato = 'attiva' AND archiviata = false
          AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
        GROUP BY ciclo
      ) sub
    ), '{}'::JSON),
    'scadenze_30gg', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND completata = false
        AND data_scadenza IS NOT NULL
        AND data_scadenza <= CURRENT_DATE + 30
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'scadenze_15gg', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'attiva' AND completata = false
        AND data_scadenza IS NOT NULL
        AND data_scadenza <= CURRENT_DATE + 15
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'completate_mese', (
      SELECT COUNT(*) FROM pratiche
      WHERE completata = true
        AND completata_at >= date_trunc('month', CURRENT_DATE)
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'sospese', (
      SELECT COUNT(*) FROM pratiche
      WHERE stato = 'sospesa'
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'promemoria_attivi', (
      SELECT COUNT(*) FROM promemoria
      WHERE completato = false
        AND (v_effective_user_id IS NULL OR assegnato_a = v_effective_user_id)
    ),
    'notifiche_non_lette', (
      SELECT COUNT(*) FROM notifiche
      WHERE letta = false
        AND (v_effective_user_id IS NULL OR destinatario_id = v_effective_user_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_statistiche_dashboard(UUID) IS
  'KPI dashboard — operatore forzato a vedere solo propri dati (fix sicurezza F1.2)';

REVOKE ALL ON FUNCTION get_statistiche_dashboard(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_statistiche_dashboard(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 3: user_profiles
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: tutti gli autenticati (lookup nomi in pratiche, messaggi, ecc.)
-- INSERT: solo admin o l'utente stesso (auto-creazione profilo dopo signup)
-- UPDATE: admin modifica tutti, utente modifica solo sé stesso
-- DELETE: nessuno (soft delete via attivo = false)

CREATE POLICY "user_profiles_select"
  ON user_profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "user_profiles_insert"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "user_profiles_update"
  ON user_profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    id = auth.uid()
    OR get_user_role() = 'admin'
  );

-- No DELETE policy → nessuno può eliminare profili (soft delete via attivo)


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 4: clienti
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: tutti gli autenticati (operatori visualizzano in sola lettura)
-- INSERT: admin, responsabile
-- UPDATE: admin, responsabile
-- DELETE: nessuno (soft delete via attivo = false)

CREATE POLICY "clienti_select"
  ON clienti FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clienti_insert"
  ON clienti FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'responsabile'));

CREATE POLICY "clienti_update"
  ON clienti FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'responsabile'))
  WITH CHECK (get_user_role() IN ('admin', 'responsabile'));

-- No DELETE policy → soft delete via attivo = false


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 5: consulenti
-- ═══════════════════════════════════════════════════════════════════════════
-- Stessa logica di clienti

CREATE POLICY "consulenti_select"
  ON consulenti FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "consulenti_insert"
  ON consulenti FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'responsabile'));

CREATE POLICY "consulenti_update"
  ON consulenti FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'responsabile'))
  WITH CHECK (get_user_role() IN ('admin', 'responsabile'));

-- No DELETE policy → soft delete via attivo = false


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 6: norme_catalogo
-- ═══════════════════════════════════════════════════════════════════════════
-- Tabella di riferimento (17 norme ISO) — raramente modificata
-- SELECT: tutti gli autenticati
-- INSERT/UPDATE/DELETE: solo admin

CREATE POLICY "norme_catalogo_select"
  ON norme_catalogo FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "norme_catalogo_insert"
  ON norme_catalogo FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "norme_catalogo_update"
  ON norme_catalogo FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "norme_catalogo_delete"
  ON norme_catalogo FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 7: pratiche (TABELLA PIÙ CRITICA)
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: admin/responsabile vedono tutte, operatore solo assegnato_a = self
-- INSERT: admin/responsabile creano qualsiasi, operatore crea solo con assegnato_a = self
-- UPDATE: admin/responsabile modificano tutte, operatore solo sue
-- DELETE: solo admin (per cleanup; normalmente: archiviata=true o stato='annullata')

CREATE POLICY "pratiche_select"
  ON pratiche FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('admin', 'responsabile')
    OR assegnato_a = auth.uid()
  );

CREATE POLICY "pratiche_insert"
  ON pratiche FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'responsabile')
    OR (
      get_user_role() = 'operatore'
      AND assegnato_a = auth.uid()
    )
  );

CREATE POLICY "pratiche_update"
  ON pratiche FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('admin', 'responsabile')
    OR assegnato_a = auth.uid()
  )
  WITH CHECK (
    get_user_role() IN ('admin', 'responsabile')
    OR assegnato_a = auth.uid()
  );

CREATE POLICY "pratiche_delete"
  ON pratiche FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 8: allegati
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: eredita visibilità dalla pratica associata
-- INSERT: chi ha accesso alla pratica può caricare allegati
-- UPDATE: solo admin o chi ha caricato il file
-- DELETE: solo admin o chi ha caricato il file

CREATE POLICY "allegati_select"
  ON allegati FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = allegati.pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );

CREATE POLICY "allegati_insert"
  ON allegati FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );

CREATE POLICY "allegati_update"
  ON allegati FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR caricato_da = auth.uid()
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR caricato_da = auth.uid()
  );

CREATE POLICY "allegati_delete"
  ON allegati FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR caricato_da = auth.uid()
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 9: storico_fasi (IMMUTABILE)
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: eredita visibilità dalla pratica
-- INSERT: NESSUNA policy → solo il trigger log_cambio_fase() (SECURITY DEFINER)
-- UPDATE: NESSUNA policy → immutabile
-- DELETE: NESSUNA policy → immutabile

CREATE POLICY "storico_fasi_select"
  ON storico_fasi FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = storico_fasi.pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );

-- ZERO policy INSERT/UPDATE/DELETE = immutabilità garantita da RLS


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 10: notifiche
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: solo il destinatario o admin
-- INSERT: NESSUNA policy → solo via crea_notifica() SECURITY DEFINER
-- UPDATE: solo il destinatario (segna come letta)
-- DELETE: destinatario o admin (pulizia)

CREATE POLICY "notifiche_select"
  ON notifiche FOR SELECT TO authenticated
  USING (
    destinatario_id = auth.uid()
    OR get_user_role() = 'admin'
  );

-- ZERO policy INSERT → forza uso di crea_notifica() SECURITY DEFINER

CREATE POLICY "notifiche_update"
  ON notifiche FOR UPDATE TO authenticated
  USING (destinatario_id = auth.uid())
  WITH CHECK (destinatario_id = auth.uid());

CREATE POLICY "notifiche_delete"
  ON notifiche FOR DELETE TO authenticated
  USING (
    destinatario_id = auth.uid()
    OR get_user_role() = 'admin'
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 11: messaggi_interni
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: accesso alla pratica E (msg pubblico OR destinatario/autore OR admin)
-- INSERT: autore = self E ha accesso alla pratica
-- UPDATE: chi ha accesso alla pratica (per aggiornare letto_da)
-- DELETE: solo admin

CREATE POLICY "messaggi_interni_select"
  ON messaggi_interni FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = messaggi_interni.pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
    AND (
      destinatario_id IS NULL
      OR destinatario_id = auth.uid()
      OR autore_id = auth.uid()
      OR get_user_role() = 'admin'
    )
  );

CREATE POLICY "messaggi_interni_insert"
  ON messaggi_interni FOR INSERT TO authenticated
  WITH CHECK (
    autore_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );

CREATE POLICY "messaggi_interni_update"
  ON messaggi_interni FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = messaggi_interni.pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );

CREATE POLICY "messaggi_interni_delete"
  ON messaggi_interni FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 12: promemoria
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: admin/resp vedono tutti, operatore vede assegnato_a=self o creato_da=self
-- INSERT: creato_da = self (trigger SECURITY DEFINER per promemoria automatici)
-- UPDATE: admin, assegnato_a, creato_da (per completare/modificare)
-- DELETE: admin o creato_da

CREATE POLICY "promemoria_select"
  ON promemoria FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('admin', 'responsabile')
    OR assegnato_a = auth.uid()
    OR creato_da = auth.uid()
  );

CREATE POLICY "promemoria_insert"
  ON promemoria FOR INSERT TO authenticated
  WITH CHECK (
    creato_da = auth.uid()
    OR get_user_role() = 'admin'
  );

CREATE POLICY "promemoria_update"
  ON promemoria FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR assegnato_a = auth.uid()
    OR creato_da = auth.uid()
  )
  WITH CHECK (
    get_user_role() = 'admin'
    OR assegnato_a = auth.uid()
    OR creato_da = auth.uid()
  );

CREATE POLICY "promemoria_delete"
  ON promemoria FOR DELETE TO authenticated
  USING (
    get_user_role() = 'admin'
    OR creato_da = auth.uid()
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 13: pratiche_norme (junction table)
-- ═══════════════════════════════════════════════════════════════════════════
-- Eredita visibilità dalla pratica associata

CREATE POLICY "pratiche_norme_select"
  ON pratiche_norme FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = pratiche_norme.pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );

CREATE POLICY "pratiche_norme_insert"
  ON pratiche_norme FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );

CREATE POLICY "pratiche_norme_delete"
  ON pratiche_norme FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = pratiche_norme.pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 14: responsabili_norme (junction table)
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: tutti (per filtri e visualizzazione)
-- INSERT/DELETE: solo admin (gestione ruoli)

CREATE POLICY "responsabili_norme_select"
  ON responsabili_norme FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "responsabili_norme_insert"
  ON responsabili_norme FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "responsabili_norme_delete"
  ON responsabili_norme FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 15: consulenti_norme (junction table)
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT: tutti (per lookup e selezione)
-- INSERT/DELETE: admin, responsabile

CREATE POLICY "consulenti_norme_select"
  ON consulenti_norme FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "consulenti_norme_insert"
  ON consulenti_norme FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'responsabile'));

CREATE POLICY "consulenti_norme_delete"
  ON consulenti_norme FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin', 'responsabile'));


-- ═══════════════════════════════════════════════════════════════════════════
-- RIEPILOGO: 37 policies su 13 tabelle
-- ═══════════════════════════════════════════════════════════════════════════
-- user_profiles:       3 (SELECT, INSERT, UPDATE)
-- clienti:             3 (SELECT, INSERT, UPDATE)
-- consulenti:          3 (SELECT, INSERT, UPDATE)
-- norme_catalogo:      4 (SELECT, INSERT, UPDATE, DELETE)
-- pratiche:            4 (SELECT, INSERT, UPDATE, DELETE)
-- allegati:            4 (SELECT, INSERT, UPDATE, DELETE)
-- storico_fasi:        1 (SELECT only — IMMUTABILE)
-- notifiche:           3 (SELECT, UPDATE, DELETE)
-- messaggi_interni:    4 (SELECT, INSERT, UPDATE, DELETE)
-- promemoria:          4 (SELECT, INSERT, UPDATE, DELETE)
-- pratiche_norme:      3 (SELECT, INSERT, DELETE)
-- responsabili_norme:  3 (SELECT, INSERT, DELETE)
-- consulenti_norme:    3 (SELECT, INSERT, DELETE)
