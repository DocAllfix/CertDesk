/**
 * Hook dashboard con statistiche KPI e feed attività real-time.
 *
 * useDashboardStats()
 *   — query completa via getStatisticheDashboard
 *   — refetch automatico ogni 5 minuti
 *
 * useUltimaAttivita()
 *   — ultimi 10 eventi storico_fasi
 *   — real-time via Supabase Realtime (storico_fasi INSERT)
 *   — invalidazione automatica cache a ogni nuovo evento
 */
import { useEffect, useRef }                    from 'react'
import { useQuery, useQueryClient }             from '@tanstack/react-query'
import type { RealtimeChannel }                 from '@supabase/supabase-js'

import { supabase }                             from '@/lib/supabase'
import { getStatisticheDashboard, getUltimaAttivita } from '@/lib/queries/dashboard'
import { useAuth }                              from '@/hooks/useAuth'

// ── Query key factory ─────────────────────────────────────────────

export const dashboardKeys = {
  stats:    (userId: string, isResp: boolean) =>
    ['dashboard', 'stats', userId, isResp] as const,
  attivita: () => ['dashboard', 'attivita']  as const,
}

// ── Hook statistiche ──────────────────────────────────────────────

/**
 * KPI dashboard completi.
 * Usa isResponsabile (admin | responsabile) per determinare il perimetro dati.
 * Refetch automatico ogni 5 minuti.
 */
export function useDashboardStats() {
  const { user, isResponsabile } = useAuth()

  return useQuery({
    queryKey:        dashboardKeys.stats(user?.id ?? '', isResponsabile),
    queryFn:         () => getStatisticheDashboard(user!.id, isResponsabile),
    enabled:         !!user?.id,
    staleTime:       5 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

// ── Hook ultime attività + real-time ─────────────────────────────

/**
 * Ultimi 10 eventi storico_fasi.
 * Mantiene un canale Supabase Realtime che invalida la cache
 * a ogni nuovo evento (INSERT su storico_fasi).
 */
export function useUltimaAttivita() {
  const qc         = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const channelName = `storico-fasi-dashboard-${Date.now()}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'storico_fasi',
        },
        () => {
          qc.invalidateQueries({ queryKey: dashboardKeys.attivita() })
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
  }, [qc])

  return useQuery({
    queryKey:        dashboardKeys.attivita(),
    queryFn:         getUltimaAttivita,
    staleTime:       2 * 60_000,
    refetchInterval: 2 * 60_000,
  })
}
