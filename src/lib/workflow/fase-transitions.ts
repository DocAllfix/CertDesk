/**
 * Pre-validazione frontend per transizioni di fase.
 *
 * IMPORTANTE: questa funzione è SOLO per UX — mostra all'utente cosa manca
 * PRIMA del tentativo di update. La validazione autoritativa è nel trigger
 * PostgreSQL `validate_fase_transition` (migration 006).
 *
 * Se canAdvanceFase() restituisce true ma il DB rifiuta →
 * mostrare l'errore del trigger DB all'utente senza modificarlo.
 *
 * Prerequisiti (da DDL migration 006, L80-98):
 * - → programmazione_verifica: nessuno
 * - → richiesta_proforma:     data_verifica IS NOT NULL
 * - → elaborazione_pratica:   proforma_emessa = true
 * - → firme:                  documenti_ricevuti = true
 * - → completata:             nessuno
 */

import type { FaseType, Pratica } from '@/types/app.types'

// ── Ordine fasi (identico all'array nel trigger DB) ──────────────

export const FASI_ORDINE: readonly FaseType[] = [
  'contratto_firmato',
  'programmazione_verifica',
  'richiesta_proforma',
  'elaborazione_pratica',
  'firme',
  'completata',
] as const

export const FASE_INDEX: Record<FaseType, number> = {
  contratto_firmato:       0,
  programmazione_verifica: 1,
  richiesta_proforma:      2,
  elaborazione_pratica:    3,
  firme:                   4,
  completata:              5,
}

// ── Label fasi (per messaggi UI) ─────────────────────────────────

export const FASE_LABELS: Record<FaseType, string> = {
  contratto_firmato:       'Contratto Firmato',
  programmazione_verifica: 'Programmazione Verifica',
  richiesta_proforma:      'Richiesta Proforma',
  elaborazione_pratica:    'Elaborazione Pratica',
  firme:                   'Firme',
  completata:              'Completata',
}

// ── Risultato pre-validazione ────────────────────────────────────

export interface PreValidazioneFase {
  canAdvance: boolean
  missingPrereqs: string[]
}

// ── Navigazione fasi ─────────────────────────────────────────────

export function getNextFase(fase: FaseType): FaseType | null {
  const idx = FASE_INDEX[fase]
  return idx < FASI_ORDINE.length - 1 ? FASI_ORDINE[idx + 1] : null
}

export function getPrevFase(fase: FaseType): FaseType | null {
  const idx = FASE_INDEX[fase]
  return idx > 0 ? FASI_ORDINE[idx - 1] : null
}

// ── Pre-validazione ──────────────────────────────────────────────

/**
 * Controlla se i prerequisiti per avanzare a `nuovaFase` sono soddisfatti.
 *
 * SOLO PER UX — il trigger DB è la fonte di verità.
 *
 * I campi Pick corrispondono 1:1 ai nomi colonna in database.types.ts (L372-411):
 * - fase:               Database["public"]["Enums"]["fase_type"]
 * - stato:              Database["public"]["Enums"]["stato_pratica_type"]
 * - data_verifica:      string | null
 * - proforma_emessa:    boolean | null
 * - documenti_ricevuti: boolean | null
 */
export function canAdvanceFase(
  pratica: Pick<Pratica, 'fase' | 'stato' | 'data_verifica' | 'proforma_emessa' | 'documenti_ricevuti'>,
  nuovaFase: FaseType
): PreValidazioneFase {
  const missing: string[] = []

  // Pratica non attiva → non si può avanzare (trigger L64-66)
  if (pratica.stato !== 'attiva') {
    missing.push(`La pratica è in stato "${pratica.stato}" — deve essere attiva per avanzare`)
    return { canAdvance: false, missingPrereqs: missing }
  }

  const currentIdx = FASE_INDEX[pratica.fase]
  const targetIdx  = FASE_INDEX[nuovaFase]

  // Solo +1 o -1 step (trigger L72-77)
  if (targetIdx - currentIdx > 1) {
    missing.push('Non è possibile saltare fasi')
    return { canAdvance: false, missingPrereqs: missing }
  }
  if (currentIdx - targetIdx > 1) {
    missing.push('Retrocessione massima di una fase')
    return { canAdvance: false, missingPrereqs: missing }
  }

  // Stessa fase → noop
  if (currentIdx === targetIdx) {
    return { canAdvance: false, missingPrereqs: ['La pratica è già in questa fase'] }
  }

  // Prerequisiti solo per avanzamento (trigger L80-98)
  if (targetIdx > currentIdx) {
    switch (nuovaFase) {
      case 'programmazione_verifica':
        // nessun prerequisito
        break
      case 'richiesta_proforma':
        if (!pratica.data_verifica) {
          missing.push('Data verifica obbligatoria per avanzare a Richiesta Proforma')
        }
        break
      case 'elaborazione_pratica':
        if (!pratica.proforma_emessa) {
          missing.push('Proforma deve essere emessa per avanzare a Elaborazione Pratica')
        }
        break
      case 'firme':
        if (!pratica.documenti_ricevuti) {
          missing.push('Documenti devono essere ricevuti per avanzare a Firme')
        }
        break
      case 'completata':
        // nessun prerequisito (da firme a completata)
        break
    }
  }

  return { canAdvance: missing.length === 0, missingPrereqs: missing }
}

// ── Blocco fase 4 ────────────────────────────────────────────────

/**
 * Determina se la pratica è bloccata in fase 4 (elaborazione_pratica)
 * per documenti non ricevuti. Usato per alert rosso nel dettaglio.
 */
export function isBloccataFase4(
  pratica: Pick<Pratica, 'fase' | 'documenti_ricevuti'>
): boolean {
  return pratica.fase === 'elaborazione_pratica' && !pratica.documenti_ricevuti
}
