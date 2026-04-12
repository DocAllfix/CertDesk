/**
 * Query layer Supabase per la tabella consulenti.
 * Tutte le funzioni lanciano un Error con messaggio in italiano in caso di errore.
 */
import { supabase } from '@/lib/supabase'
import type { Inserts, Updates } from '@/lib/supabase'

export type InsertConsulente = Inserts<'consulenti'>
export type UpdateConsulente = Updates<'consulenti'>

// ── Lettura ─────────────────────────────────────────────────────

/**
 * Restituisce tutti i consulenti attivi.
 * Se `search` è fornito, filtra per nome, cognome o azienda (case-insensitive).
 */
export async function getConsulenti(search?: string) {
  let query = supabase
    .from('consulenti')
    .select('*, consulenti_norme(norma_codice)')
    .eq('attivo', true)
    .order('nome', { ascending: true })

  if (search && search.trim() !== '') {
    const term = search.trim()
    query = query.or(`nome.ilike.%${term}%,cognome.ilike.%${term}%,azienda.ilike.%${term}%`)
  }

  const { data, error } = await query

  if (error) throw new Error(`Errore nel caricamento dei consulenti: ${error.message}`)
  return data
}

/**
 * Restituisce tutti i consulenti archiviati (attivo = false).
 * Usato dalla pagina Archivio per il ripristino.
 */
export async function getConsulentiArchiviati(search?: string) {
  let query = supabase
    .from('consulenti')
    .select('*, consulenti_norme(norma_codice)')
    .eq('attivo', false)
    .order('nome', { ascending: true })

  if (search && search.trim() !== '') {
    const term = search.trim()
    query = query.or(`nome.ilike.%${term}%,cognome.ilike.%${term}%,azienda.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Errore nel caricamento dei consulenti archiviati: ${error.message}`)
  return data
}

/**
 * Restituisce un singolo consulente per ID.
 * Lancia un errore se non trovato.
 */
export async function getConsulente(id: string) {
  const { data, error } = await supabase
    .from('consulenti')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`Errore nel caricamento del consulente: ${error.message}`)
  if (!data) throw new Error('Consulente non trovato')
  return data
}

// ── Scrittura ────────────────────────────────────────────────────

export async function createConsulente(data: InsertConsulente) {
  const { data: created, error } = await supabase
    .from('consulenti')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`Errore nella creazione del consulente: ${error.message}`)
  if (!created) throw new Error('Creazione consulente fallita: nessun dato restituito')
  return created
}

export async function updateConsulente(id: string, data: UpdateConsulente) {
  const { data: updated, error } = await supabase
    .from('consulenti')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Errore nell'aggiornamento del consulente: ${error.message}`)
  if (!updated) throw new Error('Aggiornamento consulente fallito: nessun dato restituito')
  return updated
}

/**
 * Soft delete: imposta attivo = false e salva la nota di archiviazione.
 * La nota è obbligatoria (enforced lato UI) per tracciabilità.
 */
export async function softDeleteConsulente(id: string, nota: string) {
  const { error } = await supabase
    .from('consulenti')
    .update({ attivo: false, nota_archiviazione: nota })
    .eq('id', id)

  if (error) throw new Error(`Errore nell'archiviazione del consulente: ${error.message}`)
}

/** Ripristina un consulente archiviato: attivo → true, nota_archiviazione → null. */
export async function ripristinaConsulente(id: string) {
  const { error } = await supabase
    .from('consulenti')
    .update({ attivo: true, nota_archiviazione: null })
    .eq('id', id)

  if (error) throw new Error(`Errore nel ripristino del consulente: ${error.message}`)
}

// ── Norme ────────────────────────────────────────────────────────

/** Restituisce i codici norme associati a un consulente */
export async function getConsulentiNorme(consulenteId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('consulenti_norme')
    .select('norma_codice')
    .eq('consulente_id', consulenteId)

  if (error) throw new Error(`Errore nel caricamento delle norme del consulente: ${error.message}`)
  return (data ?? []).map((r) => r.norma_codice)
}

/**
 * Sostituisce le norme di un consulente (delete + insert).
 * Non è atomico, ma accettabile per questo use case.
 */
export async function setConsulentiNorme(consulenteId: string, norme: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from('consulenti_norme')
    .delete()
    .eq('consulente_id', consulenteId)

  if (delError) throw new Error(`Errore nella rimozione delle norme: ${delError.message}`)

  if (norme.length === 0) return

  const rows = norme.map((norma_codice) => ({ consulente_id: consulenteId, norma_codice }))
  const { error: insError } = await supabase.from('consulenti_norme').insert(rows)

  if (insError) throw new Error(`Errore nel salvataggio delle norme: ${insError.message}`)
}
