/**
 * Hooks TanStack Query v5 per la gestione degli audit integrati.
 *
 * staleTime 30s: gli audit cambiano al passo con le pratiche figlie.
 * Invalidazione cascata: mutation audit → invalida anche pratiche
 * (la pratica può mostrare il badge audit, quindi deve ri-fetchare).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAuditIntegrati,
  getAuditIntegrato,
  createAuditIntegrato,
  updateAuditIntegrato,
  deleteAuditIntegrato,
  scollegaPraticaDaAudit,
  collegaPraticaAdAudit,
} from '@/lib/queries/audit-integrati'
import { praticheKeys } from './usePratiche'
import type { CreaAuditIntegratoInput } from '@/types/app.types'

// ── Query Keys ───────────────────────────────────────────────────

export const auditKeys = {
  all:    ['audit-integrati']                                    as const,
  lists:  ()            => ['audit-integrati', 'list']           as const,
  list:   (f?: Record<string, unknown>) => ['audit-integrati', 'list', f] as const,
  detail: (id: string)  => ['audit-integrati', 'detail', id]    as const,
}

// ── Query: Lista ─────────────────────────────────────────────────

export function useAuditIntegrati(filtri?: {
  cliente_id?: string | null
  ricerca?: string | null
  solo_completati?: boolean
  solo_attivi?: boolean
}) {
  return useQuery({
    queryKey:  auditKeys.list(filtri as Record<string, unknown>),
    queryFn:   () => getAuditIntegrati(filtri),
    staleTime: 30_000,
  })
}

// ── Query: Singolo ───────────────────────────────────────────────

export function useAuditIntegrato(id: string | undefined) {
  return useQuery({
    queryKey:  auditKeys.detail(id ?? ''),
    queryFn:   () => getAuditIntegrato(id!),
    enabled:   !!id,
    staleTime: 30_000,
  })
}

// ── Mutations ────────────────────────────────────────────────────

export function useCreateAuditIntegrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreaAuditIntegratoInput) => createAuditIntegrato(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.lists() })
      qc.invalidateQueries({ queryKey: praticheKeys.lists() })
    },
  })
}

export function useUpdateAuditIntegrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { note?: string | null } }) =>
      updateAuditIntegrato(id, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: auditKeys.detail(id) })
      qc.invalidateQueries({ queryKey: auditKeys.lists() })
    },
  })
}

export function useDeleteAuditIntegrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAuditIntegrato(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.all })
      qc.invalidateQueries({ queryKey: praticheKeys.lists() })
    },
  })
}

export function useScollegaPraticaDaAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (praticaId: string) => scollegaPraticaDaAudit(praticaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.all })
      qc.invalidateQueries({ queryKey: praticheKeys.all })
    },
  })
}

export function useCollegaPraticaAdAudit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ praticaId, auditId }: { praticaId: string; auditId: string }) =>
      collegaPraticaAdAudit(praticaId, auditId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.all })
      qc.invalidateQueries({ queryKey: praticheKeys.all })
    },
  })
}
