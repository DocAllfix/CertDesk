/**
 * Workflow orchestrator — esegue avanzamento fase con notifiche.
 *
 * Flusso completo:
 *   1. Chiama avanzaFase() → update DB (trigger valida)
 *   2. Se successo → createFaseChangeNotifications() (best-effort, non bloccante)
 *   3. Restituisce la pratica aggiornata
 *
 * Se il DB rifiuta (trigger) → l'errore viene propagato direttamente.
 * Se le notifiche falliscono → silenziate, l'avanzamento NON viene annullato.
 */

import { avanzaFase } from '@/lib/queries/pratiche'
import { createFaseChangeNotifications, notifyAuditCompletato } from './notifications'
import type { FaseType, UserProfile, AuditIntegratoRef } from '@/types/app.types'

// ── Parametri orchestrator ───────────────────────────────────────

export interface ExecuteAvanzaFaseParams {
  /** UUID della pratica */
  praticaId: string
  /** Fase corrente PRIMA dell'avanzamento */
  oldFase: FaseType
  /** Fase target dell'avanzamento */
  nuovaFase: FaseType
  /** UUID dell'utente che esegue l'azione */
  userId: string
  /** Lista utenti attivi — serve per trovare admin e nomi per le notifiche */
  allUsers: Pick<UserProfile, 'id' | 'ruolo' | 'nome' | 'cognome'>[]
  /** Nome cliente — per notifiche leggibili (es. "CERT-2026-0001 (Acme Srl)") */
  clienteNome?: string
  /** Motivo opzionale (usato in storico_fasi) */
  motivo?: string
  /** Ref audit integrato — se presente, controlla completamento audit dopo avanzamento */
  audit?: AuditIntegratoRef | null
}

// ── Orchestrator principale ──────────────────────────────────────

/**
 * Esegue l'avanzamento fase con notifiche automatiche.
 *
 * @returns La pratica aggiornata (row Tables<'pratiche'> dal DB)
 * @throws Error — messaggio dal trigger DB se la transizione è rifiutata
 */
export async function executeAvanzaFase(params: ExecuteAvanzaFaseParams) {
  const { praticaId, oldFase, nuovaFase, userId, allUsers, clienteNome, motivo, audit } = params

  // 1. Update DB — il trigger validate_fase_transition valida tutto
  const updated = await avanzaFase(praticaId, nuovaFase, userId, motivo)

  // 2. Notifiche best-effort — fire & forget, non bloccante
  //    Usa i dati della pratica AGGIORNATA (ha fase/stato/flag correnti)
  createFaseChangeNotifications(
    {
      id:                 updated.id,
      numero_pratica:     updated.numero_pratica,
      assegnato_a:        updated.assegnato_a,
      auditor_id:         updated.auditor_id,
      documenti_ricevuti: updated.documenti_ricevuti,
      cliente_nome:       clienteNome,
    },
    oldFase,
    nuovaFase,
    userId,
    allUsers
  ).catch(() => {
    // Silenzio: le notifiche sono best-effort
  })

  // 3. Se la pratica fa parte di un audit e viene completata,
  //    controlla se tutto l'audit è completato e notifica
  if (audit && nuovaFase === 'completata') {
    notifyAuditCompletato(audit, { id: updated.id }, userId, allUsers).catch(() => {
      // Silenzio: best-effort
    })
  }

  return updated
}
