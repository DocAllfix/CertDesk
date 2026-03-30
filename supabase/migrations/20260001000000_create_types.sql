-- =============================================================================
-- Migration 001 — Enums e Types
-- CertDesk: tutti i tipi enumerati usati nel sistema
-- Fonte di verità: DDL_RLS_schema.md
-- =============================================================================

-- Ruoli utenti interni
CREATE TYPE user_role AS ENUM (
  'admin',
  'responsabile',
  'operatore'
);

-- Tipo ciclo di certificazione
CREATE TYPE ciclo_type AS ENUM (
  'certificazione',
  'prima_sorveglianza',
  'seconda_sorveglianza',
  'ricertificazione'
);

-- Fasi del workflow a 5 step (+completata)
CREATE TYPE fase_type AS ENUM (
  'contratto_firmato',
  'programmazione_verifica',
  'richiesta_proforma',
  'elaborazione_pratica',
  'firme',
  'completata'
);

-- Stato della pratica
CREATE TYPE stato_pratica_type AS ENUM (
  'attiva',
  'annullata',
  'sospesa'
);

-- Tipo di contatto commerciale
CREATE TYPE contatto_type AS ENUM (
  'consulente',
  'diretto'
);

-- Tipo notifica interna
CREATE TYPE notifica_tipo AS ENUM (
  'info',
  'warning',
  'critical',
  'success',
  'richiesta',
  'sistema'
);

-- Tipo messaggio nel feed interno
CREATE TYPE messaggio_tipo AS ENUM (
  'commento',
  'richiesta',
  'risposta',
  'sistema'
);
