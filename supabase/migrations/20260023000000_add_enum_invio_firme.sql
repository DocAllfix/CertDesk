-- =============================================================================
-- Migration 023 — Aggiunge valore 'invio_firme' all'enum fase_type
--
-- NOTA: ALTER TYPE ... ADD VALUE non può stare in un transaction block.
-- Questa migration è separata per questo motivo.
-- =============================================================================

ALTER TYPE fase_type ADD VALUE IF NOT EXISTS 'invio_firme' BEFORE 'completata';
