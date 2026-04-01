/**
 * Hooks TanStack Query v5 per la gestione delle pratiche.
 *
 * staleTime 2 minuti: le pratiche cambiano con aggiornamenti workflow.
 * refetchInterval 60s (lista): polling leggero per ricevere aggiornamenti di altri utenti.
 * useAvanzaFase invalida praticheKeys.all: il cambio fase impatta pipeline,
 * scadenze e dashboard — meglio invalidare tutto che lasciare cache stale.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPratiche,
  getPratica,
  createPratica,
  updatePratica,
  sospendPratica,
  annullaPratica,
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
    staleTime:       1000 * 60 * 2,  // 2 minuti
    refetchInterval: 1000 * 60,      // polling ogni 60s (aggiornamenti altri utenti)
  })
}

// ── Query: Singola ───────────────────────────────────────────────

export function usePratica(id: string | undefined) {
  return useQuery({
    queryKey:  praticheKeys.detail(id ?? ''),
    queryFn:   () => getPratica(id!),
    enabled:   !!id,
    staleTime: 1000 * 60 * 2,
  })
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
      qc.invalidateQueries({ queryKey: praticheKeys.lists() })
      qc.setQueryData(praticheKeys.detail(updated.id), updated)
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
      motivo,
    }: {
      id: string
      oldFase: FaseType
      nuovaFase: FaseType
      userId: string
      allUsers: Pick<UserProfile, 'id' | 'ruolo'>[]
      motivo?: string
    }) => executeAvanzaFase({
      praticaId: id,
      oldFase,
      nuovaFase,
      userId,
      allUsers,
      motivo,
    }),
    onSuccess: (updated) => {
      // Cambio fase impatta pipeline, scadenze, dashboard → invalida tutta la cache pratiche
      qc.invalidateQueries({ queryKey: praticheKeys.all })
      // Aggiorna subito il dettaglio per evitare flash di dati vecchi
      qc.setQueryData(praticheKeys.detail(updated.id), updated)
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
    },
  })
}
