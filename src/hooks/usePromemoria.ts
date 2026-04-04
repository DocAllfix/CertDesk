/**
 * Hook TanStack Query v5 per la gestione dei promemoria.
 *
 * staleTime 2 minuti: i promemoria cambiano frequentemente (toggle, nuovi).
 * Invalidazione: tutte le mutations invalidano promemoriaKeys.all (prefix match)
 * per aggiornare sia la vista pratica che la pagina globale in un solo colpo.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import {
  getPromemoriaPerPratica,
  getPromemoriaUtente,
  createPromemoria,
  toggleCompletato,
  deletePromemoria,
  type CreatePromemoriaData,
} from '@/lib/queries/promemoria'

// ── Query Keys ────────────────────────────────────────────────────

export const promemoriaKeys = {
  all:     ['promemoria']                                  as const,
  pratica: (id: string) => ['promemoria', 'pratica', id]  as const,
  utente:  (id: string) => ['promemoria', 'utente',  id]  as const,
}

// ── Query: per pratica ────────────────────────────────────────────

export function usePromemoriaPerPratica(praticaId: string) {
  return useQuery({
    queryKey: promemoriaKeys.pratica(praticaId),
    queryFn:  () => getPromemoriaPerPratica(praticaId),
    staleTime: 1000 * 60 * 2,
  })
}

// ── Query: globale utente corrente ────────────────────────────────

export function usePromemoriaUtente() {
  const { user } = useAuth()
  return useQuery({
    queryKey: promemoriaKeys.utente(user?.id ?? ''),
    queryFn:  () => getPromemoriaUtente(user!.id),
    enabled:  !!user,
    staleTime: 1000 * 60 * 2,
  })
}

// ── Mutations ─────────────────────────────────────────────────────

export function useCreatePromemoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePromemoriaData) => createPromemoria(data),
    onSuccess: () => {
      // Invalida tutti i promemoria — aggiorna sia lista pratica che pagina globale.
      qc.invalidateQueries({ queryKey: promemoriaKeys.all })
    },
  })
}

export function useTogglePromemoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completato }: { id: string; completato: boolean }) =>
      toggleCompletato(id, completato),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: promemoriaKeys.all })
    },
  })
}

export function useDeletePromemoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => deletePromemoria(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: promemoriaKeys.all })
    },
  })
}
