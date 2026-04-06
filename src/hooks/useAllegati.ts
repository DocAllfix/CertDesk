/**
 * Hooks per la gestione degli allegati delle pratiche.
 *
 * useAllegatiPratica  — lista allegati di una pratica (TanStack Query)
 * useUploadAllegato   — mutation upload con invalidazione automatica
 * useDeleteAllegato   — mutation delete con invalidazione automatica
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  uploadAllegato,
  deleteAllegato,
  type UploadAllegatoParams,
} from '@/lib/storage/allegati'
import { useAuth } from '@/hooks/useAuth'
import type { AllegatoConCaricatoDa } from '@/types/app.types'

// ── Query key factory ─────────────────────────────────────────────

export const allegatiKeys = {
  pratica: (praticaId: string) => ['allegati', praticaId] as const,
}

// ── Query layer ───────────────────────────────────────────────────

async function fetchAllegatiPratica(praticaId: string): Promise<AllegatoConCaricatoDa[]> {
  const { data, error } = await supabase
    .from('allegati')
    .select('*, caricato_da_profile:user_profiles!allegati_caricato_da_fkey(id, nome, cognome)')
    .eq('pratica_id', praticaId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Errore nel caricamento degli allegati: ${error.message}`)
  return (data ?? []) as AllegatoConCaricatoDa[]
}

// ── Hooks pubblici ────────────────────────────────────────────────

/** Lista allegati di una pratica, aggiornata dopo ogni upload/delete. */
export function useAllegatiPratica(praticaId: string | undefined) {
  return useQuery({
    queryKey: allegatiKeys.pratica(praticaId ?? ''),
    queryFn: () => fetchAllegatiPratica(praticaId!),
    enabled: !!praticaId,
    staleTime: 15_000,          // 15s — allegati possono cambiare da altri utenti
    refetchInterval: 30_000,    // polling ogni 30s per propagazione cross-client
  })
}

/** Mutation per caricare un allegato. Invalida la lista allegati al successo. */
export function useUploadAllegato(praticaId: string) {
  const queryClient = useQueryClient()
  const { userProfile } = useAuth()

  return useMutation({
    mutationFn: (params: Omit<UploadAllegatoParams, 'praticaId' | 'caricatoDa'>) =>
      uploadAllegato({ ...params, praticaId, caricatoDa: userProfile?.id ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allegatiKeys.pratica(praticaId) })
    },
  })
}

/** Mutation per eliminare un allegato. Invalida la lista allegati al successo. */
export function useDeleteAllegato(praticaId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (allegatoId: string) => deleteAllegato(allegatoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allegatiKeys.pratica(praticaId) })
    },
  })
}
