-- =============================================================================
-- Migration 009 — Storage Policies per bucket allegati-pratiche
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================
-- Il bucket "allegati-pratiche" è PRIVATO (nessun accesso pubblico).
-- Le policy su storage.objects controllano chi può caricare, leggere ed eliminare.
--
-- Strategia di sicurezza:
--   SELECT:  utenti autenticati (il path contiene UUID non indovinabile;
--            la tabella allegati con RLS impedisce di scoprire i path)
--   INSERT:  utenti autenticati (la RLS su tabella allegati gestisce
--            il controllo di accesso per pratica lato DB)
--   UPDATE:  disabilitato (no sovrascrittura — ogni versione è un nuovo upload)
--   DELETE:  admin (get_user_role()='admin') O proprietario del file (owner = auth.uid())
--
-- Nota: storage.objects.owner viene impostato automaticamente da Supabase
-- all'auth.uid() dell'utente che ha effettuato l'upload.
-- =============================================================================

-- ── SELECT ────────────────────────────────────────────────────────
-- Necessario per createSignedUrl lato client (SDK JS v2).
-- L'accesso anonimo è bloccato dalla clausola TO authenticated.
CREATE POLICY "allegati_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'allegati-pratiche');

-- ── INSERT ────────────────────────────────────────────────────────
-- Qualsiasi utente autenticato può caricare nella propria cartella.
-- Il controllo "ha accesso alla pratica" è imposto dalla RLS su
-- INSERT su tabella allegati (migration 008, policy allegati_insert).
CREATE POLICY "allegati_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'allegati-pratiche');

-- ── DELETE ────────────────────────────────────────────────────────
-- Solo admin o chi ha caricato il file (owner = auth.uid()).
CREATE POLICY "allegati_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'allegati-pratiche'
    AND (
      get_user_role() = 'admin'
      OR owner = auth.uid()
    )
  );
