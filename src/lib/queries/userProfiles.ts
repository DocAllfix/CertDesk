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

/**
 * Restituisce gli user_id degli utenti che gestiscono almeno una delle norme indicate.
 * Usato per filtrare operatori nel dropdown "Assegnato a" per le norme selezionate.
 */
export async function getOperatoriPerNorme(normeCodici: string[]): Promise<string[]> {
  if (normeCodici.length === 0) return []

  const { data, error } = await supabase
    .from('responsabili_norme')
    .select('user_id')
    .in('norma_codice', normeCodici)

  if (error) throw new Error(`Errore nel caricamento operatori per norme: ${error.message}`)

  // Deduplica: un operatore può comparire N volte se ha più norme selezionate
  const uniqueIds = [...new Set((data ?? []).map(r => r.user_id))]
  return uniqueIds
}

/**
 * Restituisce gli user_id di tutti gli utenti che hanno almeno una norma in responsabili_norme.
 * Usato per distinguere i responsabili assegnabili (con norme) da quelli non assegnabili
 * (es. segretaria senza norme di competenza).
 */
export async function getUtentiConNorme(): Promise<string[]> {
  const { data, error } = await supabase
    .from('responsabili_norme')
    .select('user_id')

  if (error) throw new Error(`Errore nel caricamento utenti con norme: ${error.message}`)

  const uniqueIds = [...new Set((data ?? []).map(r => r.user_id))]
  return uniqueIds
}
