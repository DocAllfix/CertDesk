/**
 * Hooks TanStack Query v5 per la gestione delle pratiche.
 *
 * staleTime 30s (lista): le pratiche cambiano con aggiornamenti workflow.
 * refetchInterval 60s (lista): polling leggero per ricevere aggiornamenti di altri utenti.
 * useAvanzaFase invalida praticheKeys.all: il cambio fase impatta pipeline,
 * scadenze e dashboard — meglio invalidare tutto che lasciare cache stale.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  getPratiche,
  getPratica,
  createPratica,
  updatePratica,
  sospendPratica,
  annullaPratica,
  archiviaPratica,
  ripristinaPratica,
  type CreatePraticaData,
  type UpdatePratica,
} from '@/lib/queries/pratiche'
import { executeAvanzaFase } from '@/lib/workflow'
import type { FiltriPratiche, FaseType, UserProfile } from '@/types/app.types'

// ── Query Keys ───────────────────────────────────────────────────

export const praticheKeys = {
  all:    ['pratiche']                                        as const,
  lists:  ()                    => ['pratiche', 'list']       as const,
  list:   (f: FiltriPratiche)   => ['pratiche', 'list', f]    as const,
  detail: (id: string)          => ['pratiche', 'detail', id] as const,
}

// ── Query: Lista ─────────────────────────────────────────────────

export function usePratiche(filtri: FiltriPratiche = {}) {
  return useQuery({
    queryKey:        praticheKeys.list(filtri),
    queryFn:         () => getPratiche(filtri),
    staleTime:       30_000,          // 30s — dati pratiche cambiano frequentemente
    refetchInterval: 60_000,          // polling ogni 60s (aggiornamenti altri utenti)
  })
}

// ── Query: Singola ───────────────────────────────────────────────

export function usePratica(id: string | undefined) {
  return useQuery({
    queryKey:  praticheKeys.detail(id ?? ''),
    queryFn:   () => getPratica(id!),
    enabled:   !!id,
    staleTime: 30_000,
  })
}

// ── Prefetch on hover ───────────────────────────────────────────

export function usePrefetchPratica() {
  const qc = useQueryClient()
  return useCallback((id: string) => {
    qc.prefetchQuery({
      queryKey: praticheKeys.detail(id),
      queryFn:  () => getPratica(id),
      staleTime: 30_000,
    })
  }, [qc])
}

// ── Mutations ────────────────────────────────────────────────────

export function useCreatePratica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePraticaData) => createPratica(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: praticheKeys.lists() })
    },
  })
}

export function useUpdatePratica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePratica }) =>
      updatePratica(id, data),
    onSuccess: (updated) => {
      // Invalida lista E dettaglio: updatePratica restituisce solo la flat row
      // (senza join), quindi non è sicuro usare setQueryData sul dettaglio.
      // invalidateQueries triggera un refetch con i dati completi.
      qc.invalidateQueries({ queryKey: praticheKeys.lists() })
      qc.invalidateQueries({ queryKey: praticheKeys.detail(updated.id) })
    },
  })
}

export function useAvanzaFase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      oldFase,
      nuovaFase,
      userId,
      allUsers,
      clienteNome,
      motivo,
    }: {
      id: string
      oldFase: FaseType
      nuovaFase: FaseType
      userId: string
      allUsers: Pick<UserProfile, 'id' | 'ruolo' | 'nome' | 'cognome'>[]
      clienteNome?: string
      motivo?: string
    }) => executeAvanzaFase({
      praticaId: id,
      oldFase,
      nuovaFase,
      userId,
      allUsers,
      clienteNome,
      motivo,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: praticheKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSospendiPratica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      sospendPratica(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: praticheKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAnnullaPratica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      annullaPratica(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: praticheKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useArchiviaPratica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiviaPratica(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: praticheKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useRipristinaPratica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ripristinaPratica(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: praticheKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
