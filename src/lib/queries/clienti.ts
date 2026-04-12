/**
 * Query layer Supabase per la tabella clienti.
 * Tutte le funzioni lanciano un Error con messaggio in italiano in caso di errore.
 */
import { supabase } from '@/lib/supabase'
import type { Inserts, Updates } from '@/lib/supabase'

export type InsertCliente = Inserts<'clienti'>
export type UpdateCliente = Updates<'clienti'>

// ── Lettura ─────────────────────────────────────────────────────

/**
 * Restituisce tutti i clienti attivi.
 * Se `search` è fornito, filtra per nome o ragione_sociale (case-insensitive).
 */
export async function getClienti(search?: string) {
  let query = supabase
    .from('clienti')
    .select('*')
    .eq('attivo', true)
    .order('nome', { ascending: true })

  if (search && search.trim() !== '') {
    const term = search.trim()
    query = query.or(`nome.ilike.%${term}%,ragione_sociale.ilike.%${term}%`)
  }

  const { data, error } = await query

  if (error) throw new Error(`Errore nel caricamento dei clienti: ${error.message}`)
  return data
}

/**
 * Restituisce tutti i clienti archiviati (attivo = false).
 * Usato dalla pagina Archivio per il ripristino.
 */
export async function getClientiArchiviati(search?: string) {
  let query = supabase
    .from('clienti')
    .select('*')
    .eq('attivo', false)
    .order('nome', { ascending: true })

  if (search && search.trim() !== '') {
    const term = search.trim()
    query = query.or(`nome.ilike.%${term}%,ragione_sociale.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Errore nel caricamento dei clienti archiviati: ${error.message}`)
  return data
}

/**
 * Restituisce un singolo cliente per ID.
 * Lancia un errore se non trovato.
 */
export async function getCliente(id: string) {
  const { data, error } = await supabase
    .from('clienti')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`Errore nel caricamento del cliente: ${error.message}`)
  if (!data) throw new Error('Cliente non trovato')
  return data
}

// ── Scrittura ────────────────────────────────────────────────────

export async function createCliente(data: InsertCliente) {
  const { data: created, error } = await supabase
    .from('clienti')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`Errore nella creazione del cliente: ${error.message}`)
  if (!created) throw new Error('Creazione cliente fallita: nessun dato restituito')
  return created
}

export async function updateCliente(id: string, data: UpdateCliente) {
  const { data: updated, error } = await supabase
    .from('clienti')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Errore nell'aggiornamento del cliente: ${error.message}`)
  if (!updated) throw new Error('Aggiornamento cliente fallito: nessun dato restituito')
  return updated
}

/**
 * Soft delete: imposta attivo = false e salva la nota di archiviazione.
 * La nota è obbligatoria (enforced lato UI) per tracciabilità.
 */
export async function softDeleteCliente(id: string, nota: string) {
  const { error } = await supabase
    .from('clienti')
    .update({ attivo: false, nota_archiviazione: nota })
    .eq('id', id)

  if (error) throw new Error(`Errore nell'archiviazione del cliente: ${error.message}`)
}

/** Ripristina un cliente archiviato: attivo → true, nota_archiviazione → null. */
export async function ripristinaCliente(id: string) {
  const { error } = await supabase
    .from('clienti')
    .update({ attivo: true, nota_archiviazione: null })
    .eq('id', id)

  if (error) throw new Error(`Errore nel ripristino del cliente: ${error.message}`)
}
