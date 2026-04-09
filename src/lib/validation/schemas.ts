/**
 * Schemi Zod centralizzati — validazione completa per tutti i form CertDesk.
 *
 * Ogni schema applica:
 * - Campi obbligatori con messaggi in italiano
 * - Limiti caratteri su campi testo libero (note: 2000, messaggi: 5000)
 * - Validazione formato (email, P.IVA, CAP)
 * - Trim automatico via z.string().trim()
 */
import { z } from 'zod'

// ── Helpers riusabili ────────────────────────────────────────────

/** Stringa opzionale che diventa null se vuota (per campi DB nullable). */
const optStr = z.string().trim().optional()

/** Stringa opzionale con validazione email. Accetta vuoto/null. */
const optEmail = z.union([
  z.string().trim().pipe(z.string().email('Email non valida')),
  z.literal(''),
  z.null(),
]).optional()

/** Campo note: max 2000 caratteri. */
const noteField = z.string().trim().max(2000, 'Massimo 2000 caratteri').optional()

// ── P.IVA italiana ───────────────────────────────────────────────
// 11 cifre numeriche, opzionale con prefisso IT

const pivaRegex = /^(?:IT)?\d{11}$/

const optPiva = z.union([
  z.string().trim().refine(
    (v) => v === '' || pivaRegex.test(v),
    { message: 'P.IVA non valida: deve essere di 11 cifre (es. 01234567890 o IT01234567890)' }
  ),
  z.null(),
]).optional()

// ── CAP italiano ─────────────────────────────────────────────────

const capRegex = /^\d{5}$/

const optCap = z.union([
  z.string().trim().refine(
    (v) => v === '' || capRegex.test(v),
    { message: 'CAP non valido: deve essere di 5 cifre' }
  ),
  z.null(),
]).optional()

// ══════════════════════════════════════════════════════════════════
// PRATICA
// ══════════════════════════════════════════════════════════════════

// Fasi in ordine (usato per validazione import)
const FASI = [
  'contratto_firmato', 'programmazione_verifica',
  'richiesta_proforma', 'elaborazione_pratica', 'firme', 'completata',
] as const

const faseEnum = z.enum(FASI)

export const praticaSchema = z.object({
  cliente_id:    z.string().min(1, 'Seleziona un cliente'),
  norme:         z.array(z.string()).min(1, 'Seleziona almeno una norma'),
  ciclo:         z.enum([
    'certificazione', 'prima_sorveglianza', 'seconda_sorveglianza',
    'terza_sorveglianza', 'quarta_sorveglianza', 'follow_up_review',
    'ricertificazione', 'ricertificazione_30m',
  ] as const),
  tipo_contatto: z.enum(['consulente', 'diretto'] as const),

  consulente_id:   z.string().nullable().optional(),
  referente_nome:  optStr.nullable(),
  referente_email: optEmail,
  referente_tel:   optStr.nullable(),

  assegnato_a:   z.string().nullable().optional(),
  data_scadenza: z.string().min(1, 'La data di scadenza è obbligatoria'),
  note:          z.string().trim().max(2000, 'Massimo 2000 caratteri').nullable().optional(),
  priorita:      z.number().int().min(0).max(2),

  auditor_id:    z.string().nullable().optional(),
  data_verifica: z.string().nullable().optional(),
  sede_verifica: z.string().trim().max(200, 'Massimo 200 caratteri').nullable().optional(),

  proforma_richiesta: z.boolean().nullable().optional(),
  documenti_ricevuti: z.boolean().nullable().optional(),

  numero_certificato:         z.string().trim().max(100, 'Massimo 100 caratteri').nullable().optional(),
  data_emissione_certificato: z.string().nullable().optional(),
  data_scadenza_certificato:  z.string().nullable().optional(),

  // ── Campi contesto form ─────────────────────────────────────────
  _isEdit:               z.boolean().optional(),
}).superRefine((d, ctx) => {
  // ── Validazione data_scadenza ─────────────────────────────────
  // In creazione (non modifica): scadenza non può essere nel passato
  if (!d._isEdit && d.data_scadenza) {
    const oggi = new Date().toISOString().split('T')[0]
    if (d.data_scadenza < oggi) {
      ctx.addIssue({
        code: 'custom',
        message: 'La data di scadenza non può essere nel passato',
        path: ['data_scadenza'],
      })
    }
  }

  // ── Validazione standard ─────────────────────────────────────
  if (d.tipo_contatto === 'consulente' && !d.consulente_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Seleziona un consulente',
      path: ['consulente_id'],
    })
  }
  if (d.data_verifica && d.data_scadenza && d.data_verifica > d.data_scadenza) {
    ctx.addIssue({
      code: 'custom',
      message: 'La data di verifica non può essere successiva alla scadenza della pratica',
      path: ['data_verifica'],
    })
  }
})

export type PraticaFormValues = z.infer<typeof praticaSchema>

// ══════════════════════════════════════════════════════════════════
// CLIENTE
// ══════════════════════════════════════════════════════════════════

export const clienteSchema = z.object({
  nome:              z.string().trim().min(1, 'Nome obbligatorio'),
  ragione_sociale:   optStr,
  piva:              optPiva,
  codice_fiscale:    optStr,
  email:             optEmail,
  pec:               optEmail,
  telefono:          optStr,
  indirizzo:         optStr,
  citta:             optStr,
  cap:               optCap,
  codice_ea:         optStr,
  codice_nace:       optStr,
  numero_dipendenti: optStr,
  note:              noteField,
})

export type ClienteFormValues = z.infer<typeof clienteSchema>

// ══════════════════════════════════════════════════════════════════
// CONSULENTE
// ══════════════════════════════════════════════════════════════════

export const consulenteSchema = z.object({
  nome:     z.string().trim().min(1, 'Nome obbligatorio'),
  cognome:  optStr,
  azienda:  optStr,
  email:    optEmail,
  telefono: optStr,
  note:     noteField,
})

export type ConsulenteFormValues = z.infer<typeof consulenteSchema>

// ══════════════════════════════════════════════════════════════════
// MESSAGGIO INTERNO
// ══════════════════════════════════════════════════════════════════

export const messaggioSchema = z.object({
  testo: z.string().trim().min(1, 'Il messaggio non può essere vuoto').max(5000, 'Massimo 5000 caratteri'),
  tipo:  z.enum(['commento', 'richiesta'] as const),
  destinatarioId: z.string().nullable().optional(),
  allegatoId:     z.string().nullable().optional(),
})

export type MessaggioFormValues = z.infer<typeof messaggioSchema>

// ══════════════════════════════════════════════════════════════════
// AVANZA FASE (motivo retrocessione)
// ══════════════════════════════════════════════════════════════════

export const avanzaFaseSchema = z.object({
  motivo: z.string().trim().max(2000, 'Massimo 2000 caratteri').optional(),
})

export type AvanzaFaseFormValues = z.infer<typeof avanzaFaseSchema>

// ══════════════════════════════════════════════════════════════════
// IMPORT PRATICA PREESISTENTE
// ══════════════════════════════════════════════════════════════════

export const importPraticaSchema = z.object({
  // ── Dati base pratica ──────────────────────────────────────────
  cliente_id:    z.string().min(1, 'Seleziona un cliente'),
  norme:         z.array(z.string()).min(1, 'Seleziona almeno una norma'),
  ciclo:         z.enum([
    'certificazione', 'prima_sorveglianza', 'seconda_sorveglianza',
    'terza_sorveglianza', 'quarta_sorveglianza', 'follow_up_review',
    'ricertificazione', 'ricertificazione_30m',
  ] as const),
  tipo_contatto: z.enum(['consulente', 'diretto'] as const),

  consulente_id:   z.string().nullable().optional(),
  referente_nome:  optStr.nullable(),
  referente_email: optEmail,
  referente_tel:   optStr.nullable(),

  assegnato_a:   z.string().nullable().optional(),
  note:          z.string().trim().max(2000, 'Massimo 2000 caratteri').nullable().optional(),
  priorita:      z.number().int().min(0).max(2),

  // ── Campi fase-condizionali ────────────────────────────────────
  auditor_id:    z.string().nullable().optional(),
  data_verifica: z.string().nullable().optional(),
  sede_verifica: z.string().trim().max(200, 'Massimo 200 caratteri').nullable().optional(),

  numero_certificato:         z.string().trim().max(100, 'Massimo 100 caratteri').nullable().optional(),
  data_emissione_certificato: z.string().nullable().optional(),

  // ── Campi import ───────────────────────────────────────────────
  import_fase:           faseEnum,
  import_numero_pratica: z.string().trim().max(50, 'Massimo 50 caratteri').optional(),
  import_created_at:     z.string().optional(),
  import_completata_at:  z.string().optional(),

  // data_scadenza: obbligatoria solo per fasi NON completata (inserita dall'utente).
  // Per fase completata viene calcolata automaticamente nel submit.
  data_scadenza: z.string().optional(),
}).superRefine((d, ctx) => {
  // ── Tipo contatto ─────────────────────────────────────────────
  if (d.tipo_contatto === 'consulente' && !d.consulente_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Seleziona un consulente',
      path: ['consulente_id'],
    })
  }

  const faseIdx = FASI.indexOf(d.import_fase)

  // ── Fase ≥ richiesta_proforma (idx 2) → data_verifica obbligatoria ──
  if (faseIdx >= 2 && !d.data_verifica) {
    ctx.addIssue({
      code: 'custom',
      message: 'Data verifica obbligatoria per pratiche dalla fase Richiesta Proforma in poi',
      path: ['data_verifica'],
    })
  }

  // ── Branch fase = completata ──────────────────────────────────
  if (d.import_fase === 'completata') {
    if (!d.import_completata_at) {
      ctx.addIssue({
        code: 'custom',
        message: 'Data completamento obbligatoria per pratiche completate',
        path: ['import_completata_at'],
      })
    }
    // completata_at non può essere nel futuro
    if (d.import_completata_at) {
      const oggi = new Date().toISOString().split('T')[0]
      if (d.import_completata_at > oggi) {
        ctx.addIssue({
          code: 'custom',
          message: 'La data di completamento non può essere nel futuro',
          path: ['import_completata_at'],
        })
      }
    }
  } else {
    // ── Branch fase ≠ completata → data_scadenza obbligatoria ───
    if (!d.data_scadenza) {
      ctx.addIssue({
        code: 'custom',
        message: 'La data di scadenza è obbligatoria',
        path: ['data_scadenza'],
      })
    }
  }
})

export type ImportPraticaFormValues = z.infer<typeof importPraticaSchema>
