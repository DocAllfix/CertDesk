/**
 * Notifiche automatiche al cambio fase.
 *
 * Usa la funzione SQL `crea_notifica()` (SECURITY DEFINER, migration 006 L225-242)
 * per inserire nella tabella `notifiche`.
 *
 * REGOLA: le notifiche vengono create DOPO il successo dell'update fase.
 * Se l'update fallisce (trigger rifiuta), nessuna notifica viene creata.
 * Se la creazione notifica fallisce, l'avanzamento NON viene annullato
 * (notifica = best-effort, non transazionale con l'avanzamento).
 *
 * Nomi campi → da database.types.ts:
 * - notifiche.destinatario_id (L312)
 * - notifiche.mittente_id     (L317)
 * - notifiche.pratica_id      (L318)
 * - notifiche.tipo            (L319) → notifica_tipo enum
 * - notifiche.titolo          (L320)
 * - notifiche.messaggio       (L316)
 * - user_profiles.ruolo       (L719) → user_role enum
 *
 * RPC `crea_notifica` Args (5 params, migration 014):
 *   p_destinatario_id, p_pratica_id, p_tipo, p_titolo, p_messaggio
 */

import { supabase } from '@/lib/supabase'
import type { FaseType, NotificaTipo, UserProfile, Pratica } from '@/types/app.types'
import { FASE_LABELS } from './fase-transitions'

// ── Tipo interno ─────────────────────────────────────────────────

// Fix F13.1: mittente_id rimosso — il DB lo imposta a auth.uid() via SECURITY DEFINER
interface NotificaDaCreare {
  destinatario_id: string
  pratica_id: string
  tipo: NotificaTipo
  titolo: string
  messaggio: string
}

// ── Helper: invia una singola notifica via RPC ───────────────────

async function inviaNotifica(n: NotificaDaCreare): Promise<void> {
  // Fix F13.1: p_mittente_id rimosso — il DB usa auth.uid() server-side
  await supabase.rpc('crea_notifica', {
    p_destinatario_id: n.destinatario_id,
    p_pratica_id:      n.pratica_id,
    p_tipo:            n.tipo,
    p_titolo:          n.titolo,
    p_messaggio:       n.messaggio,
  })
  // Best-effort: errori silenziati.
  // La tabella notifiche mostrerà cosa è stato creato.
}

// ── Logica notifiche post-avanzamento ────────────────────────────

/**
 * Crea le notifiche appropriate dopo un avanzamento di fase riuscito.
 *
 * @param pratica   - La pratica AGGIORNATA (row DB dopo l'update).
 *                    Campi usati: id, numero_pratica, assegnato_a, auditor_id, documenti_ricevuti
 * @param oldFase   - La fase PRECEDENTE all'avanzamento
 * @param nuovaFase - La nuova fase corrente
 * @param userId    - L'utente che ha effettuato l'avanzamento (mittente)
 * @param allUsers  - Lista di tutti gli utenti attivi del sistema (per trovare admin)
 */
export async function createFaseChangeNotifications(
  pratica: Pick<Pratica, 'id' | 'numero_pratica' | 'assegnato_a' | 'auditor_id' | 'documenti_ricevuti'> & { cliente_nome?: string },
  _oldFase: FaseType,
  nuovaFase: FaseType,
  userId: string,
  allUsers: Pick<UserProfile, 'id' | 'ruolo' | 'nome' | 'cognome'>[]
): Promise<void> {
  const codice = pratica.numero_pratica ?? 'N/D'
  const np = pratica.cliente_nome ? `${codice} (${pratica.cliente_nome})` : codice
  const faseLabel = FASE_LABELS[nuovaFase]

  // Admin = user_profiles con ruolo = 'admin'
  const admins = allUsers.filter(u => u.ruolo === 'admin')

  // Nome dell'utente che ha effettuato l'avanzamento
  const currentUser = allUsers.find(u => u.id === userId)
  const nomeUtente = currentUser
    ? `${currentUser.nome ?? ''} ${currentUser.cognome ?? ''}`.trim() || 'Utente'
    : 'Utente'

  // ── 1. Notifiche specifiche per fase (hanno precedenza) ────────
  // Raccolte prima per sapere chi ha già una notifica specifica
  const specifiche: NotificaDaCreare[] = []

  switch (nuovaFase) {

    // → Fase 2: Programmazione Verifica — notifica all'auditor
    case 'programmazione_verifica':
      if (pratica.auditor_id && pratica.auditor_id !== userId) {
        specifiche.push({
          destinatario_id: pratica.auditor_id,
          pratica_id:      pratica.id,
          tipo:            'info',
          titolo:          `Verifica da programmare — ${np}`,
          messaggio:       `${nomeUtente} ha avanzato la pratica ${np} a ${faseLabel}. Sei stato assegnato come auditor.`,
        })
      }
      break

    // → Fase 3: Richiesta Proforma — notifica admin
    case 'richiesta_proforma':
      for (const admin of admins) {
        if (admin.id === userId) continue
        specifiche.push({
          destinatario_id: admin.id,
          pratica_id:      pratica.id,
          tipo:            'info',
          titolo:          `Proforma richiesta — ${np}`,
          messaggio:       `${nomeUtente} ha avanzato la pratica ${np} a ${faseLabel}. È necessario emettere la proforma.`,
        })
      }
      break

    // → Fase 4: Elaborazione Pratica — warning se documenti mancanti
    case 'elaborazione_pratica':
      if (!pratica.documenti_ricevuti && pratica.assegnato_a && pratica.assegnato_a !== userId) {
        specifiche.push({
          destinatario_id: pratica.assegnato_a,
          pratica_id:      pratica.id,
          tipo:            'warning',
          titolo:          `Documenti mancanti — ${np}`,
          messaggio:       `La pratica ${np} è in fase ${faseLabel} ma i documenti non sono ancora stati ricevuti. La pratica è bloccata.`,
        })
      }
      break

    // → Fase 5: Firme — notifica a TUTTI gli utenti coinvolti
    case 'firme': {
      const coinvoltiIds = new Set<string>()
      if (pratica.assegnato_a) coinvoltiIds.add(pratica.assegnato_a)
      if (pratica.auditor_id)  coinvoltiIds.add(pratica.auditor_id)
      for (const admin of admins) coinvoltiIds.add(admin.id)
      coinvoltiIds.delete(userId)

      for (const destId of coinvoltiIds) {
        specifiche.push({
          destinatario_id: destId,
          pratica_id:      pratica.id,
          tipo:            'info',
          titolo:          `Fase Firme — ${np}`,
          messaggio:       `${nomeUtente} ha avanzato la pratica ${np} a ${faseLabel}. Procedere con le firme.`,
        })
      }
      break
    }

    // → Completata — notifica success a admin + assegnato_a
    case 'completata': {
      const destinatari = new Set<string>()
      if (pratica.assegnato_a) destinatari.add(pratica.assegnato_a)
      for (const admin of admins) destinatari.add(admin.id)
      destinatari.delete(userId)

      for (const destId of destinatari) {
        specifiche.push({
          destinatario_id: destId,
          pratica_id:      pratica.id,
          tipo:            'success',
          titolo:          `Pratica completata — ${np}`,
          messaggio:       `La pratica ${np} è stata completata con successo da ${nomeUtente}.`,
        })
      }
      break
    }
  }

  // ── 2. Notifica generica avanzamento fase ──────────────────────
  // Inviata solo a chi NON ha già una notifica specifica per questa fase.
  // Operatore avanza → notifica a responsabili/admin
  // Responsabile/Admin avanza → notifica all'operatore assegnato
  const destinatariSpecifici = new Set(specifiche.map(n => n.destinatario_id))
  const generiche: NotificaDaCreare[] = []

  if (currentUser?.ruolo === 'operatore') {
    const responsabili = allUsers.filter(u => u.ruolo === 'admin' || u.ruolo === 'responsabile')
    for (const resp of responsabili) {
      if (resp.id === userId || destinatariSpecifici.has(resp.id)) continue
      generiche.push({
        destinatario_id: resp.id,
        pratica_id:      pratica.id,
        tipo:            'info',
        titolo:          `Avanzamento fase — ${np}`,
        messaggio:       `${nomeUtente} ha avanzato la pratica ${np} alla fase ${faseLabel}.`,
      })
    }
  } else if (currentUser?.ruolo === 'admin' || currentUser?.ruolo === 'responsabile') {
    if (pratica.assegnato_a && pratica.assegnato_a !== userId && !destinatariSpecifici.has(pratica.assegnato_a)) {
      generiche.push({
        destinatario_id: pratica.assegnato_a,
        pratica_id:      pratica.id,
        tipo:            'info',
        titolo:          `Avanzamento fase — ${np}`,
        messaggio:       `${nomeUtente} ha avanzato la pratica ${np} alla fase ${faseLabel}.`,
      })
    }
  }

  // Invio parallelo — best-effort, errori silenziati
  const tutteLeNotifiche = [...specifiche, ...generiche]
  await Promise.allSettled(tutteLeNotifiche.map(inviaNotifica))
}

// ── Notifica documenti ricevuti in fase 4 ────────────────────────

/**
 * Crea notifica success quando i documenti vengono ricevuti in fase 4.
 * Da chiamare quando documenti_ricevuti passa da false a true.
 */
export async function notifyDocumentiRicevuti(
  pratica: Pick<Pratica, 'id' | 'numero_pratica' | 'assegnato_a'>,
): Promise<void> {
  if (!pratica.assegnato_a) return

  await inviaNotifica({
    destinatario_id: pratica.assegnato_a,
    pratica_id:      pratica.id,
    tipo:            'success',
    titolo:          `Documenti ricevuti — ${pratica.numero_pratica ?? 'N/D'}`,
    messaggio:       `I documenti della pratica ${pratica.numero_pratica ?? 'N/D'} sono stati ricevuti. È ora possibile avanzare alla fase Firme.`,
  })
}
