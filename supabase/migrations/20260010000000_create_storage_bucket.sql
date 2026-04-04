-- =============================================================================
-- Migration 010 — Creazione bucket Storage allegati-pratiche
-- CertDesk — Fonte di verità: DDL_RLS_schema.md
-- =============================================================================
-- NOTA: Migration 009 (storage_policies.sql) creava le policies su
-- storage.objects ma NON il bucket. Questo file corregge la lacuna.
--
-- Proprietà del bucket:
--   - Privato (public = false): accesso solo via signed URL
--   - Limite dimensione: 50 MB (coerente con validazione frontend FileUpload.tsx)
--   - Tipi MIME ammessi: lista chiusa (coerente con ALLOWED_MIME_TYPES in FileUpload.tsx)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'allegati-pratiche',
  'allegati-pratiche',
  false,
  52428800,  -- 50 MB in bytes
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;
