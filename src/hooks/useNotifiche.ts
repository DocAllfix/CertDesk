/**
 * useNotifiche — notifiche real-time con resilienza WebSocket.
 *
 * Architettura:
 *   useNotificheSubscription() — gestisce il canale Realtime (chiamato UNA VOLTA in AppLayout)
 *   useNotifiche()             — legge dalla cache TanStack Query (usabile ovunque, no subscription)
 *   useNotificheCount()        — contatore non lette (cache)
 *
 * Resilienza:
 *   1. Subscription Supabase Realtime (WebSocket) via postgres_changes INSERT
 *   2. Heartbeat ogni 30s — se channel non è 'joined', tenta riconnessione
 *   3. Polling fallback ogni 60s — se WebSocket non è SUBSCRIBED
 *
 * Toast automatico per notifiche critiche/richiesta (sonner).
 * Stato connessione esposto via setConnectionStatus → useRealtimeStatus.
 */
import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import {
  getNotifiche,
  markNotificaAsRead,
  markAllNotificheAsRead,
  type Notifica,
} from '@/lib/queries/notifiche'
import { setConnectionStatus } from '@/hooks/useRealtimeStatus'
import { useAuth } from '@/hooks/useAuth'

// ── Costanti ─────────────────────────────────────────────────────

const HEARTBEAT_MS = 30_000  // check ogni 30 secondi
const POLLING_MS   = 60_000  // polling fallback ogni 60 secondi

// ── Query Keys ────────────────────────────────────────────────────

export const notificheKeys = {
  all: (userId: string) => ['notifiche', userId] as const,
}

// ── Toast helper per tipo notifica ────────────────────────────────

function showNotificaToast(n: Notifica): void {
  const opts = { description: n.messaggio }
  switch (n.tipo) {
    case 'critical':  toast.error(n.titolo,  opts); break
    case 'richiesta': toast(n.titolo,         { ...opts, icon: '📋' }); break
    case 'warning':   toast.warning(n.titolo, opts); break
    case 'success':   toast.success(n.titolo, opts); break
    default:          break  // 'info' e 'sistema' silenziosi
  }
}

// ── Subscription hook — chiamato UNA SOLA VOLTA in AppLayout ──────
//
// Responsabilità: canale Realtime + heartbeat + polling fallback.
// NON ritorna nulla; aggiorna solo la cache via invalidateQueries.

export function useNotificheSubscription(): void {
  const qc           = useQueryClient()
  const { user }     = useAuth()
  const userId       = user?.id
  const channelRef   = useRef<RealtimeChannel | null>(null)
  const pollingRef   = useRef(false)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return

    // Usa un nome canale univoco con timestamp per evitare collisioni
    // anche in React StrictMode (doppio mount in dev)
    const channelName = `notifiche-user-${userId}-${Date.now()}`

    setConnectionStatus('connecting')

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifiche',
          filter: `destinatario_id=eq.${userId}`,
        },
        (payload) => {
          qc.invalidateQueries({ queryKey: notificheKeys.all(userId) })
          showNotificaToast(payload.new as Notifica)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
          pollingRef.current = false
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionStatus('reconnecting')
          pollingRef.current = true
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('error')
          pollingRef.current = true
        }
      })

    channelRef.current = channel

    // ── Heartbeat ─────────────────────────────────────────────────
    heartbeatRef.current = setInterval(() => {
      if (channelRef.current?.state !== 'joined') {
        setConnectionStatus('reconnecting')
        pollingRef.current = true
        // Rimuove il canale corrente e ne crea uno nuovo
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }
        const newName = `notifiche-user-${userId}-${Date.now()}`
        const newCh = supabase
          .channel(newName)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifiche', filter: `destinatario_id=eq.${userId}` },
            (payload) => {
              qc.invalidateQueries({ queryKey: notificheKeys.all(userId) })
              showNotificaToast(payload.new as Notifica)
            },
          )
          .subscribe((s) => {
            if (s === 'SUBSCRIBED') { setConnectionStatus('connected'); pollingRef.current = false }
            else if (s === 'TIMED_OUT' || s === 'CLOSED') { setConnectionStatus('reconnecting'); pollingRef.current = true }
            else if (s === 'CHANNEL_ERROR') { setConnectionStatus('error'); pollingRef.current = true }
          })
        channelRef.current = newCh
      }
    }, HEARTBEAT_MS)

    // ── Polling fallback ──────────────────────────────────────────
    pollingTimer.current = setInterval(() => {
      if (pollingRef.current) {
        setConnectionStatus('polling')
        qc.invalidateQueries({ queryKey: notificheKeys.all(userId) })
      }
    }, POLLING_MS)

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (pollingTimer.current) clearInterval(pollingTimer.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setConnectionStatus('connecting')
    }
  }, [userId, qc])
}

// ── Lettura cache — usabile ovunque, nessuna subscription ─────────

export function useNotifiche() {
  const { user } = useAuth()
  const userId   = user?.id

  return useQuery({
    queryKey: userId ? notificheKeys.all(userId) : ['notifiche', 'noop'],
    queryFn:  () => getNotifiche(userId!),
    enabled:  !!userId,
    staleTime: 1000 * 30,
  })
}

// ── Contatore non lette ───────────────────────────────────────────

export function useNotificheCount(): number {
  const { data = [] } = useNotifiche()
  return data.filter(n => !n.letta).length
}

// ── Mutation: segna come letta ────────────────────────────────────

export function useMarkAsRead() {
  const qc       = useQueryClient()
  const { user } = useAuth()
  const userId   = user?.id

  return useMutation({
    mutationFn: (id: string) => markNotificaAsRead(id),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: notificheKeys.all(userId) })
    },
    onError: (err: Error) => {
      toast.error('Errore', { description: err.message })
    },
  })
}

// ── Mutation: segna tutte come lette ─────────────────────────────

export function useMarkAllAsRead() {
  const qc       = useQueryClient()
  const { user } = useAuth()
  const userId   = user?.id

  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Utente non autenticato')
      return markAllNotificheAsRead(userId)
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: notificheKeys.all(userId) })
    },
    onError: (err: Error) => {
      toast.error('Errore', { description: err.message })
    },
  })
}
