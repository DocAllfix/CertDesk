/**
 * Query layer Supabase per audit_integrati.
 * Tutte le funzioni lanciano Error con messaggio in italiano.
 */
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/supabase'
import type {
  AuditIntegratoView,
  AuditIntegratoConPratiche,
  CreaAuditIntegratoInput,
  AuditIntegratoRef,
} from '@/types/app.types'

// ── Lettura ─────────────────────────────────────────────────────

/**
 * Lista audit integrati dalla view vw_audit_integrati.
 * Supporta filtro per cliente e ricerca su numero_audit.
 */
export async function getAuditIntegrati(filtri?: {
  cliente_id?: string | null
  ricerca?: string | null
  solo_completati?: boolean
  solo_attivi?: boolean
}): Promise<AuditIntegratoView[]> {
  let query = supabase
    .from('vw_audit_integrati' as 'audit_integrati')
    .select('*')

  if (filtri?.cliente_id) {
    query = query.eq('cliente_id', filtri.cliente_id)
  }
  if (filtri?.ricerca?.trim()) {
    query = query.ilike('numero_audit', `%${filtri.ricerca.trim()}%`)
  }
  if (filtri?.solo_completati) {
    query = query.eq('is_completato' as 'id', true as unknown as string)
  }
  if (filtri?.solo_attivi) {
    query = query.eq('is_completato' as 'id', false as unknown as string)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw new Error(`Errore nel caricamento degli audit integrati: ${error.message}`)
  return (data ?? []) as unknown as AuditIntegratoView[]
}

/**
 * Singolo audit integrato con tutte le pratiche figlie.
 */
export async function getAuditIntegrato(id: string): Promise<AuditIntegratoConPratiche> {
  // Fetch audit
  const { data: audit, error: auditError } = await supabase
    .from('audit_integrati')
    .select('*, cliente:clienti(id,nome,ragione_sociale)')
    .eq('id', id)
    .single()

  if (auditError) {
    if (auditError.code === 'PGRST116') throw new Error('Audit integrato non trovato')
    throw new Error(`Errore nel caricamento dell'audit: ${auditError.message}`)
  }
  if (!audit) throw new Error('Audit integrato non trovato')

  // Fetch pratiche figlie
  const { data: pratiche, error: pratError } = await supabase
    .from('pratiche')
    .select(
      '*, ' +
      'cliente:clienti(id,nome,ragione_sociale), ' +
      'consulente:consulenti(id,nome,cognome), ' +
      'assegnato:user_profiles!pratiche_assegnato_a_fkey(id,nome,cognome,avatar_url), ' +
      'pratiche_norme(norma_codice)'
    )
    .eq('audit_integrato_id', id)
    .order('audit_progressivo', { ascending: true, nullsFirst: false })

  if (pratError) throw new Error(`Errore nel caricamento delle pratiche dell'audit: ${pratError.message}`)

  const praticheList = (pratiche ?? []).map((p) => {
    const pRaw = p as unknown as Tables<'pratiche'> & { pratiche_norme: { norma_codice: string }[] | null }
    return {
      ...pRaw,
      norme: (pRaw.pratiche_norme ?? []).map((pn) => ({ codice: pn.norma_codice, nome: pn.norma_codice })),
      audit: { id: audit.id, numero_audit: audit.numero_audit } as AuditIntegratoRef,
    }
  })

  const completate = praticheList.filter((p) => p.fase === 'completata').length

  return {
    ...audit,
    cliente: (audit as Record<string, unknown>).cliente as AuditIntegratoConPratiche['cliente'],
    pratiche: praticheList as unknown as AuditIntegratoConPratiche['pratiche'],
    pratiche_totali: praticheList.length,
    pratiche_completate: completate,
    is_completato: praticheList.length > 0 && completate === praticheList.length,
    prima_scadenza: praticheList
      .filter((p) => p.fase !== 'completata' && p.data_scadenza)
      .sort((a, b) => (a.data_scadenza! > b.data_scadenza! ? 1 : -1))[0]?.data_scadenza ?? null,
  } as AuditIntegratoConPratiche
}

// ── Scrittura ───────────────────────────────────────────────────

/**
 * Crea un audit integrato con N pratiche single-norma.
 * Tutte le pratiche condividono cliente, ciclo, contatto.
 * Ogni pratica ha la propria norma, assegnato_a, auditor.
 *
 * NOTA: non è transazionale (Supabase JS non supporta cross-table tx).
 * In caso di errore parziale, l'audit potrebbe restare con meno pratiche
 * del previsto. Per v1 è accettabile — l'utente può aggiungere manualmente.
 */
export async function createAuditIntegrato(input: CreaAuditIntegratoInput) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Utente non autenticato')

  // Validazioni client-side (difesa in profondità — il DB le enforce via trigger)
  if (input.pratiche.length < 2) {
    throw new Error('Un audit integrato deve avere almeno 2 pratiche')
  }
  const hasSA8000 = input.pratiche.some((p) => p.norma_codice === 'SA 8000')
  if (hasSA8000) {
    throw new Error('SA 8000 non può far parte di un audit integrato (ciclo 36 mesi)')
  }

  // 1. Crea audit container
  const { data: audit, error: auditError } = await supabase
    .from('audit_integrati')
    .insert({
      cliente_id: input.cliente_id,
      note: input.note ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (auditError) throw new Error(`Errore nella creazione dell'audit integrato: ${auditError.message}`)
  if (!audit) throw new Error('Creazione audit integrato fallita: nessun dato restituito')

  // 2. Crea pratiche figlie con progressivo 1..N
  const praticheCreate = []
  for (let i = 0; i < input.pratiche.length; i++) {
    const p = input.pratiche[i]
    const { data: pratica, error: pError } = await supabase
      .from('pratiche')
      .insert({
        cliente_id: input.cliente_id,
        ciclo: input.ciclo,
        tipo_contatto: input.tipo_contatto,
        consulente_id: input.consulente_id ?? null,
        referente_nome: input.referente_nome ?? null,
        referente_email: input.referente_email ?? null,
        referente_tel: input.referente_tel ?? null,
        assegnato_a: p.assegnato_a ?? null,
        auditor_id: p.auditor_id ?? null,
        data_verifica: p.data_verifica ?? null,
        data_scadenza: p.data_scadenza ?? null,
        sede_verifica: p.sede_verifica ?? null,
        audit_integrato_id: audit.id,
        audit_progressivo: i + 1,
        created_by: user.id,
      })
      .select()
      .single()

    if (pError) {
      throw new Error(
        `Errore nella creazione della pratica #${i + 1} (${p.norma_codice}): ${pError.message}`
      )
    }
    if (!pratica) throw new Error(`Pratica #${i + 1} non restituita`)

    // 3. Inserisci norma associata
    const { error: normaError } = await supabase
      .from('pratiche_norme')
      .insert({ pratica_id: pratica.id, norma_codice: p.norma_codice })

    if (normaError) {
      throw new Error(
        `Pratica #${i + 1} creata ma errore nel salvataggio della norma: ${normaError.message}`
      )
    }

    praticheCreate.push(pratica)
  }

  return { audit, pratiche: praticheCreate }
}

/**
 * Aggiorna i dati base di un audit integrato (note, cliente).
 */
export async function updateAuditIntegrato(id: string, data: { note?: string | null }) {
  const { data: updated, error } = await supabase
    .from('audit_integrati')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Errore nell'aggiornamento dell'audit: ${error.message}`)
  if (!updated) throw new Error('Aggiornamento audit fallito: nessun dato restituito')
  return updated
}

/**
 * Elimina un audit integrato. Le pratiche figlie restano con
 * audit_integrato_id = NULL (ON DELETE SET NULL).
 * Solo admin.
 */
export async function deleteAuditIntegrato(id: string) {
  const { error } = await supabase
    .from('audit_integrati')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Errore nell'eliminazione dell'audit: ${error.message}`)
}

/**
 * Scollega una pratica da un audit (la rende stand-alone).
 * Solo admin/responsabile.
 */
export async function scollegaPraticaDaAudit(praticaId: string) {
  const { error } = await supabase
    .from('pratiche')
    .update({ audit_integrato_id: null, audit_progressivo: null })
    .eq('id', praticaId)

  if (error) throw new Error(`Errore nello scollegamento della pratica dall'audit: ${error.message}`)
}

/**
 * Aggiunge una pratica esistente a un audit.
 * Richiede che la pratica abbia lo stesso cliente_id dell'audit (enforced dal trigger DB).
 */
export async function collegaPraticaAdAudit(praticaId: string, auditId: string) {
  // Calcola il prossimo progressivo
  const { data: maxProg } = await supabase
    .from('pratiche')
    .select('audit_progressivo')
    .eq('audit_integrato_id', auditId)
    .order('audit_progressivo', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  const nextProg = ((maxProg?.audit_progressivo as number | null) ?? 0) + 1

  const { error } = await supabase
    .from('pratiche')
    .update({ audit_integrato_id: auditId, audit_progressivo: nextProg })
    .eq('id', praticaId)

  if (error) throw new Error(`Errore nel collegamento della pratica all'audit: ${error.message}`)
}
