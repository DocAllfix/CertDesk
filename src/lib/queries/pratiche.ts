/**
 * Query layer Supabase per la tabella pratiche.
 * Tutte le funzioni lanciano un Error con messaggio in italiano in caso di errore.
 *
 * NOTA TRIGGER: validate_fase_transition (BEFORE UPDATE OF fase) valida tutti
 * i prerequisiti e lancia RAISE EXCEPTION con messaggi già in italiano.
 * avanzaFase() rilancia questi messaggi as-is senza wrapping.
 */
import { supabase } from '@/lib/supabase'
import type { Inserts, Updates, Tables } from '@/lib/supabase'
import type {
  FiltriPratiche,
  FaseType,
  PraticaConRelazioni,
  PraticaListItem,
  NormaCatalogo,
  Cliente,
  Consulente,
  UserProfile,
  AuditIntegratoRef,
} from '@/types/app.types'

// ── Tipi esportati ───────────────────────────────────────────────

export type InsertPratica = Inserts<'pratiche'>
export type UpdatePratica = Updates<'pratiche'>

/**
 * Tipo locale che descrive il risultato raw di Supabase per la query detail.
 * Necessario perché TypeScript non inferisce i tipi quando select() riceve
 * una stringa concatenata (non un literal type).
 */
type PraticaDetailRaw = Tables<'pratiche'> & {
  cliente:            Cliente | null
  consulente:         Consulente | null
  assegnato:          Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url' | 'ruolo'> | null
  auditor:            Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url'> | null
  created_by_profile: Pick<UserProfile, 'id' | 'nome' | 'cognome'> | null
  updated_by_profile: Pick<UserProfile, 'id' | 'nome' | 'cognome'> | null
  pratiche_norme:     { norma_codice: string; norme_catalogo: NormaCatalogo | null }[]
  audit:              AuditIntegratoRef | null
}

/**
 * Input per createPratica: tutti i campi DB + array norme da associare.
 * Il campo `norme` non è una colonna DB — viene estratto prima dell'INSERT.
 */
export type CreatePraticaData = InsertPratica & { norme?: string[] }

// ── Costanti colonne per ordinamento ────────────────────────────

/** Mappa OrdinamentoPratiche → colonna DB reale (cliente_nome non è diretta) */
const COLONNE_ORDINAMENTO: Record<string, string> = {
  numero_pratica: 'numero_pratica',
  created_at:     'created_at',
  updated_at:     'updated_at',
  data_scadenza:  'data_scadenza',
  priorita:       'priorita',
  fase:           'fase',
  stato:          'stato',
  cliente_nome:   'updated_at', // non è colonna diretta: fallback a updated_at
}

// ── Lettura ─────────────────────────────────────────────────────

/**
 * Restituisce la lista pratiche con join cliente, consulente, assegnato, norme.
 * Tutti i filtri vengono applicati lato DB (nessun filtro client-side).
 *
 * NOTA: il filtro norma_codice richiede 2 round-trip perché PostgREST
 * non supporta filtrare il record padre tramite junction table in un solo passo.
 */
export async function getPratiche(filtri: FiltriPratiche = {}) {
  // Passo 1: se filtro norma attivo, recupera gli ID pratiche corrispondenti
  let praticaIds: string[] | null = null
  if (filtri.norma_codice) {
    const { data: normaData, error: normaError } = await supabase
      .from('pratiche_norme')
      .select('pratica_id')
      .eq('norma_codice', filtri.norma_codice)

    if (normaError) throw new Error(`Errore nel filtro per norma: ${normaError.message}`)
    praticaIds = (normaData ?? []).map(r => r.pratica_id)
    // Nessuna pratica ha questa norma → ritorna subito array vuoto
    if (praticaIds.length === 0) return []
  }

  // Passo 2: query principale con join
  let query = supabase
    .from('pratiche')
    .select(
      '*, ' +
      'cliente:clienti(id,nome,ragione_sociale), ' +
      'consulente:consulenti(id,nome,cognome), ' +
      'assegnato:user_profiles!pratiche_assegnato_a_fkey(id,nome,cognome,avatar_url), ' +
      'pratiche_norme(norma_codice), ' +
      'audit:audit_integrati(id,numero_audit)'
    )

  // Filtro archiviate: solo_archiviate ha precedenza, poi includi_archiviate
  if (filtri.solo_archiviate) {
    query = query.eq('archiviata', true)
  } else if (!filtri.includi_archiviate) {
    query = query.eq('archiviata', false)
  }

  // Filtro stato — solo_attive ha precedenza su stato
  if (filtri.solo_attive) {
    query = query.eq('stato', 'attiva')
  } else if (filtri.stato) {
    query = query.eq('stato', filtri.stato)
  }

  if (filtri.escludi_completate) query = query.neq('fase', 'completata')
  if (filtri.fase)             query = query.eq('fase', filtri.fase)
  if (filtri.ciclo)            query = query.eq('ciclo', filtri.ciclo)
  if (filtri.assegnato_a)      query = query.eq('assegnato_a', filtri.assegnato_a)
  if (filtri.cliente_id)       query = query.eq('cliente_id', filtri.cliente_id)
  if (filtri.priorita != null) query = query.eq('priorita', filtri.priorita)
  if (filtri.audit_integrato_id) query = query.eq('audit_integrato_id', filtri.audit_integrato_id)
  if (filtri.scadenza_max)     query = query.lte('data_scadenza', filtri.scadenza_max)
  if (praticaIds)              query = query.in('id', praticaIds)

  // Ricerca testuale su numero_pratica e note (campi diretti della tabella)
  if (filtri.ricerca?.trim()) {
    const term = filtri.ricerca.trim()
    query = query.or(`numero_pratica.ilike.%${term}%,note.ilike.%${term}%`)
  }

  // Ordinamento primario (default: updated_at DESC → pratiche recenti prima)
  const colPrimaria = COLONNE_ORDINAMENTO[filtri.ordinamento ?? ''] ?? 'updated_at'
  const ascending   = filtri.direzione === 'asc'
  query = query.order(colPrimaria, { ascending, nullsFirst: false })

  // Ordinamento secondario fisso: scadenza ASC nulls last → urgenti in cima
  if (colPrimaria !== 'data_scadenza') {
    query = query.order('data_scadenza', { ascending: true, nullsFirst: false })
  }

  const { data, error } = await query
  if (error) throw new Error(`Errore nel caricamento delle pratiche: ${error.message}`)
  return (data ?? []) as unknown as PraticaListItem[]
}

/**
 * Restituisce una singola pratica con tutte le relazioni.
 * Mappa pratiche_norme(norme_catalogo) → norme: NormaCatalogo[]
 * per rispettare l'interfaccia PraticaConRelazioni.
 */
export async function getPratica(id: string): Promise<PraticaConRelazioni> {
  const { data, error } = await supabase
    .from('pratiche')
    .select(
      '*, ' +
      'cliente:clienti(*), ' +
      'consulente:consulenti(*), ' +
      'assegnato:user_profiles!pratiche_assegnato_a_fkey(id,nome,cognome,avatar_url,ruolo), ' +
      'auditor:user_profiles!pratiche_auditor_id_fkey(id,nome,cognome,avatar_url), ' +
      'created_by_profile:user_profiles!pratiche_created_by_fkey(id,nome,cognome), ' +
      'updated_by_profile:user_profiles!pratiche_updated_by_fkey(id,nome,cognome), ' +
      'pratiche_norme(norma_codice,norme_catalogo(codice,nome,ordine)), ' +
      'audit:audit_integrati(id,numero_audit)'
    )
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116: .single() ha trovato 0 righe — pratica non esiste o non accessibile via RLS
    if (error.code === 'PGRST116') throw new Error('Pratica non trovata')
    throw new Error(`Errore nel caricamento della pratica: ${error.message}`)
  }
  if (!data) throw new Error('Pratica non trovata')

  // Supabase non inferisce i tipi da stringhe select concatenate (restituisce GenericStringError).
  // Castiamo a PraticaDetailRaw — tipo locale che descrive esattamente la shape del risultato.
  const raw = data as unknown as PraticaDetailRaw

  // Trasforma pratiche_norme(norme_catalogo) → norme: NormaCatalogo[] flat
  const norme: NormaCatalogo[] = raw.pratiche_norme
    .map(pn => pn.norme_catalogo)
    .filter((n): n is NormaCatalogo => n !== null)

  return {
    ...raw,
    cliente:            raw.cliente,
    consulente:         raw.consulente,
    assegnato:          raw.assegnato          as UserProfile | null,
    auditor:            raw.auditor            as UserProfile | null,
    created_by_profile: raw.created_by_profile as UserProfile | null,
    updated_by_profile: raw.updated_by_profile as UserProfile | null,
    norme,
    audit:              raw.audit ?? null,
  } as PraticaConRelazioni
}

// ── Verifica duplicati ──────────────────────────────────────────

/**
 * Controlla se un numero_pratica esiste già nel DB.
 * Usata per check UX pre-submit nel form importazione.
 */
export async function checkNumeroPraticaExists(numeroPratica: string): Promise<boolean> {
  const trimmed = numeroPratica.trim()
  if (!trimmed) return false

  const { count, error } = await supabase
    .from('pratiche')
    .select('id', { count: 'exact', head: true })
    .eq('numero_pratica', trimmed)

  if (error) return false // In caso di errore, lascia passare — il DB constraint proteggerà
  return (count ?? 0) > 0
}

// ── Scrittura ────────────────────────────────────────────────────

/**
 * Crea una nuova pratica.
 * Il numero_pratica viene generato dal trigger set_numero_pratica (BEFORE INSERT).
 * Se fornite, inserisce le norme in pratiche_norme dopo la creazione.
 *
 * Import completata: se la pratica viene creata con fase = 'completata' e
 * sorveglianza_reminder_creato = true, il trigger on_pratica_completata NON
 * scatta (è BEFORE UPDATE, non INSERT). Il promemoria sorveglianza viene
 * creato qui calcolando completata_at + 365gg (o 1095gg per SA 8000),
 * formula identica al trigger DB (migration 012) e al cron recovery.
 *
 * ATTENZIONE: non è atomico — se l'inserimento norme/promemoria fallisce,
 * la pratica esiste già. Accettabile per questo use case.
 */
export async function createPratica({ norme, ...praticaData }: CreatePraticaData) {
  const { data: created, error } = await supabase
    .from('pratiche')
    .insert(praticaData)
    .select()
    .single()

  if (error) {
    // Messaggio leggibile per errore duplicato numero_pratica
    if (error.code === '23505' && error.message.includes('numero_pratica')) {
      throw new Error('Numero pratica già esistente. Usa un numero diverso o lascia vuoto per auto-generazione.')
    }
    throw new Error(`Errore nella creazione della pratica: ${error.message}`)
  }
  if (!created) throw new Error('Creazione pratica fallita: nessun dato restituito')

  if (norme && norme.length > 0) {
    const rows = norme.map(norma_codice => ({ pratica_id: created.id, norma_codice }))
    const { error: normeError } = await supabase.from('pratiche_norme').insert(rows)
    if (normeError) {
      throw new Error(
        `Pratica creata ma errore nel salvataggio delle norme: ${normeError.message}`
      )
    }
  }

  // ── Import completata: promemoria sorveglianza manuale ─────────
  // Il trigger on_pratica_completata NON scatta su INSERT (è BEFORE UPDATE).
  // Calcoliamo data_scadenza del promemoria come completata_at + 365/1095 giorni,
  // identico alla formula del trigger DB (migration 012) e del cron recovery.
  // Insert diretto (non createPromemoria) per evitare side-effect notifica.
  // creato_da è NOT NULL nel DB — serve un utente valido
  const promCreator = created.assegnato_a ?? created.created_by
  if (
    created.fase === 'completata' &&
    created.sorveglianza_reminder_creato === true &&
    created.completata_at &&
    promCreator
  ) {
    const hasSA8000 = norme?.includes('SA 8000') ?? false
    const giorniScadenza = hasSA8000 ? 1095 : 365

    const baseDate = new Date(created.completata_at)
    baseDate.setDate(baseDate.getDate() + giorniScadenza)
    const dataScadenzaProm = baseDate.toISOString().split('T')[0]

    const normeLabel = norme && norme.length > 0
      ? [...norme].sort().join(' + ')
      : '?'

    const testoSuffisso = hasSA8000 ? ' (SA8000: ciclo 36 mesi)' : ''

    const { error: promError } = await supabase.from('promemoria').insert({
      pratica_id:    created.id,
      creato_da:     promCreator,
      assegnato_a:   promCreator,
      testo:         `Sorveglianza ${normeLabel} per pratica ${created.numero_pratica ?? 'importata'} — verificare scadenza ciclo certificativo${testoSuffisso}`,
      data_scadenza: dataScadenzaProm,
    })

    // Best-effort: se il promemoria fallisce non blocca la creazione pratica
    if (promError) {
      console.warn('Promemoria sorveglianza non creato:', promError.message)
    }

    // Popola data_prossima_sorveglianza sulla pratica importata.
    // Il trigger on_pratica_completata NON scatta su INSERT (è BEFORE UPDATE),
    // quindi la colonna va impostata esplicitamente. Stessa formula del trigger.
    const { error: dpsError } = await supabase
      .from('pratiche')
      .update({ data_prossima_sorveglianza: dataScadenzaProm })
      .eq('id', created.id)

    if (dpsError) {
      console.warn('data_prossima_sorveglianza non impostata:', dpsError.message)
    }
  }

  return created
}

/**
 * Aggiorna i campi di una pratica.
 * Non gestisce le norme associate — usa setPraticaNorme() per quello.
 */
export async function updatePratica(id: string, data: UpdatePratica) {
  const { data: updated, error } = await supabase
    .from('pratiche')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Errore nell'aggiornamento della pratica: ${error.message}`)
  if (!updated) throw new Error('Aggiornamento pratica fallito: nessun dato restituito')
  return updated
}

/**
 * Avanza (o retrocede di 1) la fase di una pratica.
 *
 * IMPORTANTE: la validazione è nel trigger PostgreSQL validate_fase_transition.
 * Questo codice fa SOLO l'update di fase + updated_by.
 * Se il DB rifiuta (prerequisiti mancanti, salto fasi, pratica non attiva),
 * l'errore proviene dal trigger — già scritto in italiano — e viene rilanciato as-is.
 */
export async function avanzaFase(
  id: string,
  nuovaFase: FaseType,
  userId: string,
  _motivo?: string // Riservato per usi futuri — il trigger log_fase_change non registra il motivo
) {
  const { data: updated, error } = await supabase
    .from('pratiche')
    .update({ fase: nuovaFase, updated_by: userId })
    .eq('id', id)
    .select()
    .single()

  // Il messaggio di errore proviene dal trigger PostgreSQL (già in italiano)
  if (error) throw new Error(error.message)
  if (!updated) throw new Error('Aggiornamento fase fallito: nessun dato restituito')
  return updated
}

/**
 * Archivia una pratica (soft-archive: archiviata = true).
 * La pratica scompare dalle liste standard ma è recuperabile da ArchivioPratiche.
 */
export async function archiviaPratica(id: string) {
  const { error } = await supabase
    .from('pratiche')
    .update({ archiviata: true })
    .eq('id', id)

  if (error) throw new Error(`Errore nell'archiviazione della pratica: ${error.message}`)
}

/**
 * Ripristina una pratica dall'archivio (archiviata = false).
 * La pratica torna nella lista standard delle pratiche completate.
 */
export async function ripristinaPratica(id: string) {
  const { error } = await supabase
    .from('pratiche')
    .update({ archiviata: false })
    .eq('id', id)

  if (error) throw new Error(`Errore nel ripristino della pratica: ${error.message}`)
}

/**
 * Sospende una pratica: stato → 'sospesa'.
 * Registra automaticamente chi ha sospeso (auth.uid()) e quando.
 */
export async function sospendPratica(id: string, motivo?: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Utente non autenticato')

  const { error } = await supabase
    .from('pratiche')
    .update({
      stato:             'sospesa',
      motivo_stato:      motivo ?? null,
      stato_cambiato_at: new Date().toISOString(),
      stato_cambiato_da: user.id,
    })
    .eq('id', id)

  if (error) throw new Error(`Errore nella sospensione della pratica: ${error.message}`)
}

/**
 * Annulla una pratica: stato → 'annullata'.
 * Il motivo è obbligatorio per tracciabilità.
 * Registra automaticamente chi ha annullato (auth.uid()) e quando.
 */
export async function annullaPratica(id: string, motivo: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Utente non autenticato')

  const { error } = await supabase
    .from('pratiche')
    .update({
      stato:             'annullata',
      motivo_stato:      motivo,
      stato_cambiato_at: new Date().toISOString(),
      stato_cambiato_da: user.id,
    })
    .eq('id', id)

  if (error) throw new Error(`Errore nell'annullamento della pratica: ${error.message}`)
}

/**
 * Sostituisce le norme di una pratica (delete-all + insert).
 * Stessa strategia di setConsulentiNorme — non atomica ma accettabile.
 */
export async function setPraticaNorme(praticaId: string, norme: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from('pratiche_norme')
    .delete()
    .eq('pratica_id', praticaId)

  if (delError) throw new Error(`Errore nella rimozione delle norme: ${delError.message}`)
  if (norme.length === 0) return

  const rows = norme.map(norma_codice => ({ pratica_id: praticaId, norma_codice }))
  const { error: insError } = await supabase.from('pratiche_norme').insert(rows)
  if (insError) throw new Error(`Errore nel salvataggio delle norme: ${insError.message}`)
}
