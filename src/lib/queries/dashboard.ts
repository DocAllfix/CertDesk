/**
 * Query layer dashboard — statistiche KPI e ultime attività.
 *
 * getStatisticheDashboard(userId, isResponsabile)
 *   — combina la RPC get_statistiche_dashboard con query aggiuntive:
 *     pratiche_bloccate, scadenze_attenzione (15-45gg),
 *     pratiche_per_norma, ultime_attivita
 *   — Admin/Responsabile vedono tutto; Operatore vede solo le sue pratiche
 *
 * getUltimaAttivita()
 *   — ultimi 10 eventi storico_fasi con join cambiato_da_profile
 *   — usata da useUltimaAttivita() con real-time subscription
 */
import { supabase } from '@/lib/supabase'
import type { FaseType, StoricoFaseConUtente, StatisticheDashboard } from '@/types/app.types'

// ── Tipo risultato dashboard ──────────────────────────────────────

export interface DashboardStats {
  pratiche_attive:         number
  scadenze_critiche:       number   // < 15 giorni
  scadenze_attenzione:     number   // 15-45 giorni
  completate_questo_mese:  number
  pratiche_bloccate:       number   // fase elaborazione_pratica senza documenti
  pratiche_sospese:        number
  pratiche_per_fase:       Partial<Record<FaseType, number>>
  pratiche_per_norma:      { norma: string; count: number }[]
  ultime_attivita:         StoricoFaseConUtente[]
}

// ── Helpers ───────────────────────────────────────────────────────

/** Restituisce 'YYYY-MM-DD' aggiungendo `days` giorni alla data base */
function offsetDate(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Query principale dashboard ────────────────────────────────────

/**
 * Raccoglie tutti i KPI dashboard in parallelo dove possibile.
 *
 * @param userId        - UUID dell'utente corrente
 * @param isResponsabile - true se admin o responsabile (vede tutte le pratiche)
 */
export async function getStatisticheDashboard(
  userId:          string,
  isResponsabile:  boolean,
): Promise<DashboardStats> {
  // Se admin/responsabile la RPC riceve NULL → statistiche globali
  const rpcUserId = isResponsabile ? undefined : userId

  const today    = new Date()
  const day15Str = offsetDate(today, 15)
  const day45Str = offsetDate(today, 45)

  // ── Round 1: tutto in parallelo ─────────────────────────────────
  const [kpiResult, bloccateResult, attenzioneResult, activePraticheResult, attivitaResult] =
    await Promise.all([

      // 1a. RPC KPI base
      supabase.rpc('get_statistiche_dashboard', { p_user_id: rpcUserId }),

      // 1b. Pratiche bloccate: fase 4 senza documenti ricevuti
      (() => {
        let q = supabase
          .from('pratiche')
          .select('id', { count: 'exact', head: true })
          .eq('stato', 'attiva')
          .eq('archiviata', false)
          .eq('fase', 'elaborazione_pratica')
          .or('documenti_ricevuti.is.null,documenti_ricevuti.eq.false')
        if (!isResponsabile) q = q.eq('assegnato_a', userId)
        return q
      })(),

      // 1c. Scadenze attenzione: 15 < data_scadenza <= 45 giorni
      (() => {
        let q = supabase
          .from('pratiche')
          .select('id', { count: 'exact', head: true })
          .eq('stato', 'attiva')
          .eq('completata', false)
          .gt('data_scadenza', day15Str)
          .lte('data_scadenza', day45Str)
        if (!isResponsabile) q = q.eq('assegnato_a', userId)
        return q
      })(),

      // 1d. IDs pratiche attive — usati per pratiche_per_norma
      (() => {
        let q = supabase
          .from('pratiche')
          .select('id')
          .eq('stato', 'attiva')
          .eq('archiviata', false)
        if (!isResponsabile) q = q.eq('assegnato_a', userId)
        return q
      })(),

      // 1e. Ultime 10 attività storico_fasi
      supabase
        .from('storico_fasi')
        .select('*, cambiato_da_profile:user_profiles!storico_fasi_cambiato_da_fkey(id, nome, cognome)')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

  // ── Verifica errori ─────────────────────────────────────────────
  if (kpiResult.error)
    throw new Error(`Errore statistiche dashboard: ${kpiResult.error.message}`)
  if (kpiResult.data === null)
    throw new Error('Dati dashboard non disponibili')
  if (bloccateResult.error)
    throw new Error(`Errore pratiche bloccate: ${bloccateResult.error.message}`)
  if (attenzioneResult.error)
    throw new Error(`Errore scadenze attenzione: ${attenzioneResult.error.message}`)
  if (activePraticheResult.error)
    throw new Error(`Errore caricamento pratiche: ${activePraticheResult.error.message}`)
  if (attivitaResult.error)
    throw new Error(`Errore ultime attività: ${attivitaResult.error.message}`)

  // ── Round 2: pratiche_per_norma (dipende dagli IDs del round 1) ─
  const activePraticheIds = (activePraticheResult.data ?? []).map((p) => p.id)
  let pratiche_per_norma: { norma: string; count: number }[] = []

  if (activePraticheIds.length > 0) {
    const { data: normaRows, error: normaErr } = await supabase
      .from('pratiche_norme')
      .select('norma_codice')
      .in('pratica_id', activePraticheIds)

    if (normaErr) throw new Error(`Errore pratiche per norma: ${normaErr.message}`)

    const normaMap = new Map<string, number>()
    for (const row of normaRows ?? []) {
      normaMap.set(row.norma_codice, (normaMap.get(row.norma_codice) ?? 0) + 1)
    }
    pratiche_per_norma = Array.from(normaMap.entries())
      .map(([norma, count]) => ({ norma, count }))
      .sort((a, b) => b.count - a.count)
  }

  // ── Componi risultato ───────────────────────────────────────────
  // kpiResult.data è Json → cast al tipo conosciuto
  const kpi = kpiResult.data as unknown as StatisticheDashboard

  return {
    pratiche_attive:        kpi.totale_attive        ?? 0,
    scadenze_critiche:      kpi.scadenze_15gg         ?? 0,
    scadenze_attenzione:    attenzioneResult.count    ?? 0,
    completate_questo_mese: kpi.completate_mese       ?? 0,
    pratiche_bloccate:      bloccateResult.count      ?? 0,
    pratiche_sospese:       kpi.sospese               ?? 0,
    pratiche_per_fase:      (kpi.per_fase ?? {})      as Partial<Record<FaseType, number>>,
    pratiche_per_norma,
    ultime_attivita:        (attivitaResult.data ?? []) as StoricoFaseConUtente[],
  }
}

// ── Query attività separata (per useUltimaAttivita) ───────────────

/**
 * Ultimi 10 eventi storico_fasi — usata dall'hook con real-time.
 */
export async function getUltimaAttivita(): Promise<StoricoFaseConUtente[]> {
  const { data, error } = await supabase
    .from('storico_fasi')
    .select('*, cambiato_da_profile:user_profiles!storico_fasi_cambiato_da_fkey(id, nome, cognome)')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw new Error(`Errore ultime attività: ${error.message}`)
  return (data ?? []) as StoricoFaseConUtente[]
}
