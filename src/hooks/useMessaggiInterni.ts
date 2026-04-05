/**
 * Hook messaggi interni per pratica con real-time subscription.
 *
 * useMessaggiPratica(praticaId)
 *   — lista messaggi + canale Supabase Realtime (INSERT)
 *   — invalidata automaticamente a ogni nuovo messaggio
 *
 * useSendMessaggio(praticaId)
 *   — mutation: insert messaggio + notifiche automatiche
 *
 * useMarkMessaggioLetto()
 *   — mutation: aggiunge userId a letto_da
 *
 * useMessaggiNonLetti(praticaId, userId)
 *   — contatore messaggi non letti, legge dalla cache TanStack
 *   — NON crea subscription autonoma: si aggancia alla cache di useMessaggiPratica
 */
import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import {
  getMessaggiPratica,
  createMessaggio,
  markMessaggioLetto,
} from '@/lib/queries/messaggi'
import { useAuth } from '@/hooks/useAuth'
import type { MessaggioConRelazioni, MessaggioTipo } from '@/types/app.types'

// ── Query key factory ─────────────────────────────────────────────

export const messaggiKeys = {
  pratica: (praticaId: string) => ['messaggi', praticaId] as const,
}

// ── Hook principale: query + realtime ─────────────────────────────

/**
 * Restituisce i messaggi della pratica e mantiene un canale Realtime
 * che invalida la cache a ogni nuovo INSERT su messaggi_interni.
 *
 * Chiamato una sola volta nel componente che mostra il feed (FeedPratica).
 */
export function useMessaggiPratica(praticaId: string | undefined) {
  const qc         = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!praticaId) return

    // Nome canale univoco con timestamp — safe in React StrictMode (doppio mount)
    const channelName = `messaggi-pratica-${praticaId}-${Date.now()}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messaggi_interni',
          filter: `pratica_id=eq.${praticaId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: messaggiKeys.pratica(praticaId) })
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [praticaId, qc])

  return useQuery({
    queryKey: messaggiKeys.pratica(praticaId ?? ''),
    queryFn:  () => getMessaggiPratica(praticaId!),
    enabled:  !!praticaId,
    staleTime: 30_000,
  })
}

// ── Mutation: invia messaggio ─────────────────────────────────────

interface SendMessaggioParams {
  testo:           string
  tipo:            MessaggioTipo
  destinatarioId?: string | null
  allegatoId?:     string | null
}

export function useSendMessaggio(praticaId: string) {
  const qc     = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (params: SendMessaggioParams) => {
      if (!user?.id) throw new Error('Utente non autenticato')
      return createMessaggio({
        praticaId,
        autoreId:       user.id,
        testo:          params.testo,
        tipo:           params.tipo,
        destinatarioId: params.destinatarioId,
        allegatoId:     params.allegatoId,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messaggiKeys.pratica(praticaId) })
    },
    onError: (err: Error) => {
      toast.error("Errore nell'invio del messaggio", { description: err.message })
    },
  })
}

// ── Mutation: segna come letto ────────────────────────────────────

export function useMarkMessaggioLetto() {
  return useMutation({
    mutationFn: ({ messaggioId, userId }: { messaggioId: string; userId: string }) =>
      markMessaggioLetto(messaggioId, userId),
  })
}

// ── Contatore non letti ───────────────────────────────────────────

/**
 * Conta i messaggi non letti per l'utente nella pratica.
 * Legge dalla cache TanStack senza creare una nuova subscription.
 * Richiede che useMessaggiPratica sia già attivo per la stessa pratica.
 */
export function useMessaggiNonLetti(
  praticaId: string | undefined,
  userId:    string | undefined,
): number {
  const { data = [] } = useQuery<MessaggioConRelazioni[]>({
    queryKey: messaggiKeys.pratica(praticaId ?? ''),
    queryFn:  () => getMessaggiPratica(praticaId!),
    enabled:  !!praticaId,
    staleTime: 30_000,
  })

  if (!userId) return 0
  return data.filter((m) => !(m.letto_da ?? []).includes(userId)).length
}
