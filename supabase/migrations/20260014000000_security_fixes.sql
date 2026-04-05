-- =============================================================================
-- Migration 014 — Security Fixes (F13.1 Audit)
-- CertDesk — Applica correzioni identificate nel security audit
--
-- Fix 1: Storage SELECT policy — verifica accesso alla pratica via path prefix
-- Fix 2: crea_notifica() — rimuove p_mittente_id dal parametro pubblico
-- Fix 3: messaggi_interni_update — aggiunge WITH CHECK + restringe a autore_id
-- Fix 4: allegati INSERT — forza caricato_da = auth.uid()
-- Fix 5: get_pratiche_scadenze() — aggiunge REVOKE ALL FROM PUBLIC
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 1: Storage SELECT — controllo accesso via pratica_id nel path
-- ═══════════════════════════════════════════════════════════════════════════
-- Prima: qualsiasi authenticated poteva generare signed URL per qualsiasi path
-- nel bucket se ne conosceva il nome (security-through-obscurity).
-- Dopo:  operatori possono accedere solo a file di pratiche assegnate a loro.

DROP POLICY IF EXISTS "allegati_storage_select" ON storage.objects;

CREATE POLICY "allegati_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'allegati-pratiche'
    AND (
      -- admin e responsabile accedono a tutto
      get_user_role() IN ('admin', 'responsabile')
      OR
      -- operatore: il primo segmento del path è il pratica_id
      -- verifica che la pratica sia assegnata all'utente corrente
      EXISTS (
        SELECT 1 FROM pratiche p
        WHERE p.id::text = split_part(name, '/', 1)
          AND p.assegnato_a = auth.uid()
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 2: crea_notifica() — rimuove p_mittente_id dal parametro pubblico
-- ═══════════════════════════════════════════════════════════════════════════
-- Prima: il client poteva passare qualsiasi UUID come mittente → spoofing.
-- Dopo:  il mittente è sempre auth.uid() determinato server-side.
-- NOTA: aggiornare anche le chiamate frontend in notifications.ts

CREATE OR REPLACE FUNCTION crea_notifica(
  p_destinatario_id UUID,
  p_pratica_id      UUID,
  p_tipo            notifica_tipo,
  p_titolo          TEXT,
  p_messaggio       TEXT
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO notifiche (destinatario_id, mittente_id, pratica_id, tipo, titolo, messaggio)
  VALUES (p_destinatario_id, auth.uid(), p_pratica_id, p_tipo, p_titolo, p_messaggio)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION crea_notifica(UUID, UUID, notifica_tipo, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crea_notifica(UUID, UUID, notifica_tipo, TEXT, TEXT) TO authenticated;

-- Rimuovi la vecchia firma con 6 parametri se esiste
DROP FUNCTION IF EXISTS crea_notifica(UUID, UUID, notifica_tipo, TEXT, TEXT, UUID);


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 3: messaggi_interni_update — WITH CHECK + restrizione autore
-- ═══════════════════════════════════════════════════════════════════════════
-- Prima: chiunque avesse accesso alla pratica poteva modificare qualsiasi
--        colonna di qualsiasi messaggio visibile (nessun WITH CHECK).
-- Dopo:  solo l'autore del messaggio o admin può modificarlo.

DROP POLICY IF EXISTS "messaggi_interni_update" ON messaggi_interni;

CREATE POLICY "messaggi_interni_update"
  ON messaggi_interni FOR UPDATE TO authenticated
  USING (
    autore_id = auth.uid()
    OR get_user_role() = 'admin'
  )
  WITH CHECK (
    autore_id = auth.uid()
    OR get_user_role() = 'admin'
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 4: allegati INSERT — forza caricato_da = auth.uid()
-- ═══════════════════════════════════════════════════════════════════════════
-- Prima: il client poteva impostare caricato_da a qualsiasi UUID.
-- Dopo:  caricato_da deve essere NULL o l'utente corrente.

DROP POLICY IF EXISTS "allegati_insert" ON allegati;

CREATE POLICY "allegati_insert"
  ON allegati FOR INSERT TO authenticated
  WITH CHECK (
    -- caricato_da deve essere l'utente corrente (o NULL per retrocompatibilità)
    (caricato_da IS NULL OR caricato_da = auth.uid())
    AND EXISTS (
      SELECT 1 FROM pratiche p
      WHERE p.id = pratica_id
      AND (
        get_user_role() IN ('admin', 'responsabile')
        OR p.assegnato_a = auth.uid()
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 5: get_pratiche_scadenze() — REVOKE ALL FROM PUBLIC
-- ═══════════════════════════════════════════════════════════════════════════
-- Prima: PUBLIC (incluso anon) poteva chiamare la funzione.
-- Dopo:  solo authenticated (RLS su pratiche rimane comunque attiva).

REVOKE ALL ON FUNCTION get_pratiche_scadenze(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_pratiche_scadenze(INT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- RIEPILOGO FIX
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTA: COMMENT ON POLICY su storage.objects richiede ownership del relation
-- (owner = supabase_admin). Il ruolo postgres usato dal CLI non può farlo.
-- La documentazione della policy è nel commento di questa migration.

COMMENT ON FUNCTION crea_notifica IS
  'Fix F13.1: mittente sempre auth.uid() — rimosso p_mittente_id per prevenire spoofing';

COMMENT ON POLICY "messaggi_interni_update" ON messaggi_interni IS
  'Fix F13.1: UPDATE limitato ad autore_id = auth.uid() o admin — aggiunto WITH CHECK';

COMMENT ON POLICY "allegati_insert" ON allegati IS
  'Fix F13.1: caricato_da deve essere auth.uid() o NULL — previene attribution spoofing';
