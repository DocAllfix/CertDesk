/**
 * Query layer Supabase per messaggi_interni e storico_fasi (feed pratica).
 *
 * getMessaggiPratica     — lista messaggi con join autore + destinatario + allegato
 * getStoricoFasiPratica  — eventi sistema dal log immutabile (storico_fasi)
 * createMessaggio        — insert messaggio + notifiche automatiche
 * markMessaggioLetto     — aggiunge userId all'array letto_da
 * getTeamMembers         — utenti attivi per select destinatario
 */
import { supabase } from '@/lib/supabase'
import type { Inserts } from '@/lib/supabase'
import type {
  MessaggioConRelazioni,
  MessaggioTipo,
  StoricoFaseConUtente,
  UserProfile,
} from '@/types/app.types'

export type InsertMessaggio = Inserts<'messaggi_interni'>

// ── Lista messaggi ─────────────────────────────────────────────────

export async function getMessaggiPratica(praticaId: string): Promise<MessaggioConRelazioni[]> {
  const { data, error } = await supabase
    .from('messaggi_interni')
    .select(`
      *,
      autore:user_profiles!messaggi_interni_autore_id_fkey(id, nome, cognome, avatar_url),
      destinatario:user_profiles!messaggi_interni_destinatario_id_fkey(id, nome, cognome),
      allegato:allegati!messaggi_interni_allegato_id_fkey(*)
    `)
    .eq('pratica_id', praticaId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Errore nel caricamento delle comunicazioni: ${error.message}`)
  return (data ?? []) as MessaggioConRelazioni[]
}

// ── Storico fasi (eventi sistema) ─────────────────────────────────

export async function getStoricoFasiPratica(praticaId: string): Promise<StoricoFaseConUtente[]> {
  const { data, error } = await supabase
    .from('storico_fasi')
    .select(`
      *,
      cambiato_da_profile:user_profiles!storico_fasi_cambiato_da_fkey(id, nome, cognome)
    `)
    .eq('pratica_id', praticaId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Errore nel caricamento dello storico fasi: ${error.message}`)
  return (data ?? []) as StoricoFaseConUtente[]
}

// ── Crea messaggio + notifiche ─────────────────────────────────────

interface CreateMessaggioParams {
  praticaId:      string
  autoreId:       string
  testo:          string
  tipo:           MessaggioTipo
  destinatarioId?: string | null
  allegatoId?:    string | null
}

export async function createMessaggio(params: CreateMessaggioParams): Promise<void> {
  const { praticaId, autoreId, testo, tipo, destinatarioId, allegatoId } = params

  const { error: msgError } = await supabase
    .from('messaggi_interni')
    .insert({
      pratica_id:      praticaId,
      autore_id:       autoreId,
      testo,
      tipo,
      destinatario_id: destinatarioId ?? null,
      allegato_id:     allegatoId ?? null,
      letto_da:        [autoreId],
    })

  if (msgError) throw new Error(`Errore nell'invio del messaggio: ${msgError.message}`)

  // Notifiche automatiche — errori non bloccanti (log console)
  const testoBreve = testo.length > 100 ? `${testo.slice(0, 100)}…` : testo

  if ((tipo === 'richiesta' || tipo === 'commento') && destinatarioId) {
    // Notifica al destinatario esplicito
    const tipoNotifica = tipo === 'richiesta' ? 'richiesta' : 'info'
    const titoloNotifica = tipo === 'richiesta' ? 'Nuova richiesta' : 'Nuovo commento'
    await supabase.rpc('crea_notifica', {
      p_destinatario_id: destinatarioId,
      p_pratica_id:      praticaId,
      p_tipo:            tipoNotifica,
      p_titolo:          titoloNotifica,
      p_messaggio:       testoBreve,
    })

  } else if ((tipo === 'richiesta' || tipo === 'commento') && !destinatarioId) {
    // Broadcast: notifica a tutti gli utenti attivi tranne l'autore
    const titoloNotifica = tipo === 'richiesta' ? 'Nuova richiesta' : 'Nuovo commento'
    const tipoNotifica   = tipo === 'richiesta' ? 'richiesta' : 'info'

    const { data: utenti, error: utentiError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('attivo', true)
      .neq('id', autoreId)

    if (!utentiError && utenti) {
      for (const u of utenti) {
        await supabase.rpc('crea_notifica', {
          p_destinatario_id: u.id,
          p_pratica_id:      praticaId,
          p_tipo:            tipoNotifica,
          p_titolo:          titoloNotifica,
          p_messaggio:       testoBreve,
        })
      }
    }

  } else if (tipo === 'risposta' && destinatarioId) {
    // Notifica 'info' al destinatario (autore originale a cui si risponde)
    await supabase.rpc('crea_notifica', {
      p_destinatario_id: destinatarioId,
      p_pratica_id:      praticaId,
      p_tipo:            'info',
      p_titolo:          'Nuova risposta',
      p_messaggio:       testoBreve,
    })
  }
}

// ── Segna come letto ───────────────────────────────────────────────

export async function markMessaggioLetto(messaggioId: string, userId: string): Promise<void> {
  const { data, error: readError } = await supabase
    .from('messaggi_interni')
    .select('letto_da')
    .eq('id', messaggioId)
    .single()

  if (readError || data === null) return

  const lettoDa = data.letto_da ?? []
  if (lettoDa.includes(userId)) return

  const { error } = await supabase
    .from('messaggi_interni')
    .update({ letto_da: [...lettoDa, userId] })
    .eq('id', messaggioId)

  if (error) throw new Error(`Errore nel segnare il messaggio come letto: ${error.message}`)
}

// ── Team members per select destinatario ──────────────────────────

export async function getTeamMembers(): Promise<Pick<UserProfile, 'id' | 'nome' | 'cognome'>[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, nome, cognome')
    .eq('attivo', true)
    .order('cognome', { ascending: true })

  if (error) throw new Error(`Errore nel caricamento del team: ${error.message}`)
  return data ?? []
}
