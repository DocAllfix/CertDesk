/**
 * Query layer Supabase per user_profiles.
 * Usato per popolare select interni (assegnato_a, auditor_id).
 */
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types/app.types'

/** Tutti gli utenti attivi — per select assegnato_a / auditor */
export async function getTeamMembers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('attivo', true)
    .order('nome', { ascending: true })

  if (error) throw new Error(`Errore nel caricamento del team: ${error.message}`)
  return data ?? []
}

/**
 * Restituisce l'ID utente responsabile per una norma, o null se non definito.
 * Usato per auto-fill assegnato_a quando si sceglie la prima norma.
 */
export async function getResponsabilePerNorma(normaCodice: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('responsabili_norme')
    .select('user_id')
    .eq('norma_codice', normaCodice)
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data?.user_id ?? null
}
