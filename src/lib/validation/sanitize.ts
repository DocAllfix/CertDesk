/**
 * Sanitizzazione input testo — DOMPurify.
 *
 * Usato al submit dei form per pulire campi testo libero
 * (note, messaggi, motivi) da HTML/script injection.
 *
 * DOMPurify con ALLOWED_TAGS=[] rimuove TUTTO l'HTML,
 * restituendo solo testo puro.
 */
import DOMPurify from 'dompurify'

/** Rimuove qualsiasi tag HTML, restituisce solo testo puro + trim. */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim()
}

/** Sanitizza e restituisce null se vuoto (per campi nullable DB). */
export function sanitizeTextOrNull(input: string | null | undefined): string | null {
  const clean = sanitizeText(input)
  return clean.length > 0 ? clean : null
}
