/**
 * useRealtimeStatus — stato della connessione WebSocket Supabase Realtime.
 *
 * Implementato come singleton esterno (module-level store) con useSyncExternalStore:
 * - Nessun Context Provider necessario
 * - Aggiornamenti istantanei a tutti i consumer (Header, Sidebar, badge)
 * - Aggiornato da useNotifiche quando la subscription cambia stato
 *
 * Stato visualizzato nell'indicatore sidebar:
 *   connected   → pallino verde  (WebSocket attivo)
 *   connecting  → pallino giallo (in attesa connessione iniziale)
 *   reconnecting → pallino arancio (WebSocket caduto, tentativo riconnessione)
 *   polling     → pallino arancio (fallback polling ogni 60s)
 *   error       → pallino rosso  (errore permanente)
 */
import { useSyncExternalStore } from 'react'

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'polling'
  | 'error'

// ── Singleton store ───────────────────────────────────────────────

let _status: RealtimeConnectionStatus = 'connecting'
const _listeners = new Set<() => void>()

/** Aggiorna lo stato e notifica tutti i consumer React. Chiamato da useNotifiche. */
export function setConnectionStatus(s: RealtimeConnectionStatus): void {
  if (_status === s) return
  _status = s
  _listeners.forEach(l => l())
}

/** Restituisce lo stato corrente della connessione Realtime. */
export function useRealtimeStatus(): RealtimeConnectionStatus {
  return useSyncExternalStore(
    (cb) => {
      _listeners.add(cb)
      return () => { _listeners.delete(cb) }
    },
    () => _status,
    () => 'connecting' as const,
  )
}
