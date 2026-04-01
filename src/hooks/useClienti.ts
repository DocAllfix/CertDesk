/**
 * Hooks TanStack Query v5 per la gestione dei clienti.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getClienti,
  getCliente,
  createCliente,
  updateCliente,
  softDeleteCliente,
  type InsertCliente,
  type UpdateCliente,
} from '@/lib/queries/clienti'

// ── Query Keys ───────────────────────────────────────────────────

export const clientiKeys = {
  all:    ['clienti']                                   as const,
  list:   (search?: string) => ['clienti', 'list', search ?? ''] as const,
  detail: (id: string)      => ['clienti', 'detail', id]         as const,
}

// ── Lista ────────────────────────────────────────────────────────

export function useClienti(search?: string) {
  return useQuery({
    queryKey: clientiKeys.list(search),
    queryFn:  () => getClienti(search),
  })
}

// ── Singolo ──────────────────────────────────────────────────────

export function useCliente(id: string) {
  return useQuery({
    queryKey: clientiKeys.detail(id),
    queryFn:  () => getCliente(id),
    enabled:  !!id,
  })
}

// ── Mutations ────────────────────────────────────────────────────

export function useCreateCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InsertCliente) => createCliente(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientiKeys.all })
    },
  })
}

export function useUpdateCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCliente }) =>
      updateCliente(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: clientiKeys.all })
      qc.setQueryData(clientiKeys.detail(updated.id), updated)
    },
  })
}

export function useDeleteCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteCliente(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientiKeys.all })
    },
  })
}
