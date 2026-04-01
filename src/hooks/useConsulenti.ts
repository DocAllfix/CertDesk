/**
 * Hooks TanStack Query v5 per la gestione dei consulenti.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getConsulenti,
  getConsulente,
  createConsulente,
  updateConsulente,
  softDeleteConsulente,
  getConsulentiNorme,
  setConsulentiNorme,
  type InsertConsulente,
  type UpdateConsulente,
} from '@/lib/queries/consulenti'

// ── Query Keys ───────────────────────────────────────────────────

export const consulentiKeys = {
  all:    ['consulenti']                                      as const,
  list:   (search?: string) => ['consulenti', 'list', search ?? ''] as const,
  detail: (id: string)      => ['consulenti', 'detail', id]         as const,
}

// ── Lista ────────────────────────────────────────────────────────

export function useConsulenti(search?: string) {
  return useQuery({
    queryKey: consulentiKeys.list(search),
    queryFn:  () => getConsulenti(search),
  })
}

// ── Singolo ──────────────────────────────────────────────────────

export function useConsulente(id: string) {
  return useQuery({
    queryKey: consulentiKeys.detail(id),
    queryFn:  () => getConsulente(id),
    enabled:  !!id,
  })
}

// ── Mutations ────────────────────────────────────────────────────

export function useCreateConsulente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InsertConsulente) => createConsulente(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consulentiKeys.all })
    },
  })
}

export function useUpdateConsulente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateConsulente }) =>
      updateConsulente(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: consulentiKeys.all })
      qc.setQueryData(consulentiKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteConsulente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteConsulente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consulentiKeys.all })
    },
  })
}

// ── Norme ────────────────────────────────────────────────────────

export function useConsulentiNorme(consulenteId: string | undefined) {
  return useQuery({
    queryKey: ['consulenti_norme', consulenteId ?? ''],
    queryFn:  () => getConsulentiNorme(consulenteId!),
    enabled:  !!consulenteId,
  })
}

export function useSetConsulentiNorme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ consulenteId, norme }: { consulenteId: string; norme: string[] }) =>
      setConsulentiNorme(consulenteId, norme),
    onSuccess: (_data, { consulenteId }) => {
      // Invalida sia la cache norme isolata (usata dal modal)
      // sia la lista consulenti con JOIN embedded (usata dalle card)
      qc.invalidateQueries({ queryKey: ['consulenti_norme', consulenteId] })
      qc.invalidateQueries({ queryKey: consulentiKeys.all })
    },
  })
}
