/**
 * Query layer Supabase per la tabella promemoria.
 *
 * RLS in vigore (migration 008):
 * - SELECT: admin/responsabile vedono tutti; operatore vede solo assegnato_a=self o creato_da=self
 * - INSERT: creato_da = auth.uid() (trigger SECURITY DEFINER bypassa RLS per i reminder auto)
 * - UPDATE: admin, assegnato_a, creato_da
 * - DELETE: admin o creato_da
 *
 * I promemoria auto-generati al completamento pratica sono creati dal trigger
 * on_pratica_completata (SECURITY DEFINER) — nessun codice client necessario.
 */
import { supabase } from '@/lib/supabase'
import type { Inserts } from '@/lib/supabase'
import type { PromemoriaConRelazioni } from '@/types/app.types'

// ── Select con join ───────────────────────────────────────────────

const PROMEMORIA_SELECT = `
  *,
  pratica:pratiche!promemoria_pratica_id_fkey(id, numero_pratica, fase, stato),
  creato_da_profile:user_profiles!promemoria_creato_da_fkey(id, nome, cognome),
  assegnato_a_profile:user_profiles!promemoria_assegnato_a_fkey(id, nome, cognome)
`

// ── Lettura ───────────────────────────────────────────────────────

/**
 * Tutti i promemoria di una pratica.
 * Ordinati: attivi (non completati) prima, poi completati; per data_scadenza crescente.
 */
export async function getPromemoriaPerPratica(praticaId: string): Promise<PromemoriaConRelazioni[]> {
  const { data, error } = await supabase
    .from('promemoria')
    .select(PROMEMORIA_SELECT)
    .eq('pratica_id', praticaId)
    .order('completato', { ascending: true, nullsFirst: true })
    .order('data_scadenza', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`Errore nel caricamento dei promemoria: ${error.message}`)
  return (data ?? []) as PromemoriaConRelazioni[]
}

/**
 * Promemoria non completati dell'utente corrente (assegnato_a o creato_da).
 * Usato dalla pagina globale Promemoria.
 * Nota: per admin/responsabile la RLS restituisce tutto — la condizione OR
 * filtra ulteriormente ai soli promemoria di pertinenza dell'utente.
 */
export async function getPromemoriaUtente(userId: string): Promise<PromemoriaConRelazioni[]> {
  const { data, error } = await supabase
    .from('promemoria')
    .select(PROMEMORIA_SELECT)
    .or(`assegnato_a.eq.${userId},creato_da.eq.${userId}`)
    .or('completato.is.null,completato.eq.false')
    .order('data_scadenza', { ascending: true, nullsFirst: false })

  if (error) throw new Error(`Errore nel caricamento dei promemoria: ${error.message}`)
  return (data ?? []) as PromemoriaConRelazioni[]
}

// ── Scrittura ─────────────────────────────────────────────────────

export type CreatePromemoriaData = Pick<
  Inserts<'promemoria'>,
  'testo' | 'data_scadenza' | 'pratica_id' | 'assegnato_a' | 'creato_da'
>

export async function createPromemoria(payload: CreatePromemoriaData): Promise<void> {
  const { error } = await supabase.from('promemoria').insert(payload)
  if (error) throw new Error(`Errore nella creazione del promemoria: ${error.message}`)

  // Notifica all'assegnatario se diverso dal creatore — best-effort
  if (payload.assegnato_a && payload.creato_da && payload.pratica_id && payload.assegnato_a !== payload.creato_da) {
    const testoBreve = payload.testo.length > 100 ? `${payload.testo.slice(0, 100)}…` : payload.testo
    await supabase.rpc('crea_notifica', {
      p_destinatario_id: payload.assegnato_a,
      p_pratica_id:      payload.pratica_id,
      p_tipo:            'info' as const,
      p_titolo:          'Nuovo promemoria assegnato',
      p_messaggio:       testoBreve,
    })
  }
}

/**
 * Segna/desegna completato. Aggiorna completato_at di conseguenza.
 */
export async function toggleCompletato(id: string, completato: boolean): Promise<void> {
  const { error } = await supabase
    .from('promemoria')
    .update({
      completato,
      completato_at: completato ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw new Error(`Errore nell'aggiornamento del promemoria: ${error.message}`)
}

export async function deletePromemoria(id: string): Promise<void> {
  const { error } = await supabase.from('promemoria').delete().eq('id', id)
  if (error) throw new Error(`Errore nell'eliminazione del promemoria: ${error.message}`)
}
