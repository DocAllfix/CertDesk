/**
 * cron-scadenze — Edge Function Supabase schedulata (Deno 2)
 *
 * Eseguita ogni giorno alle 07:00 UTC (08:00 ora di Roma).
 * Cron expression: 0 7 * * *
 *
 * Quattro responsabilità:
 *
 * A) SAFETY NET PROMEMORIA ORFANI
 *    Pratiche completate (completata=true) con sorveglianza_reminder_creato=false
 *    non hanno ricevuto il reminder dal trigger DB (es. bug, migrazione dati, edge case).
 *    Il cron li crea in recovery con la stessa logica del trigger on_pratica_completata.
 *    SA8000 → +1095 giorni (36 mesi), altre norme → +365 giorni (12 mesi).
 *
 * B) NOTIFICHE ESCALATION SCADENZE PRATICHE (5 livelli)
 *    Per ogni pratica attiva con data_scadenza: 60 / 30 / 14 / 7 / 1 giorni.
 *    Soglia 0 (scadenza superata) → notifica tutti gli admin + assegnato_a.
 *    La tabella notifiche_scadenza_inviate garantisce idempotenza (no duplicati).
 *
 * C) PROMEMORIA SCADUTI (daily reminder)
 *    Promemoria non completati con data_scadenza <= oggi.
 *    Notifica una sola volta al giorno per promemoria (dedup via messaggio).
 *
 * D) ESCALATION PRE-SCADENZA PROMEMORIA (5 livelli)
 *    Per ogni promemoria non completato con data_scadenza: 60 / 30 / 14 / 7 / 1 giorni.
 *    Soglia 0 (scaduto) → notifica admin + assegnato_a.
 *    La tabella notifiche_promemoria_escalation garantisce idempotenza.
 *
 * Sicurezza: usa SUPABASE_SERVICE_ROLE_KEY (lato server, mai esposta al frontend).
 * Bypassa RLS per leggere tutte le pratiche e inserire notifiche senza auth.uid().
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Env ────────────────────────────────────────────────────────────────────────
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono iniettate automaticamente
// dall'ambiente Edge Function di Supabase. Non servono file .env separati.
const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ── Configurazione escalation ──────────────────────────────────────────────────
// Modifica qui per cambiare le soglie di notifica (in giorni).
const SOGLIE_ESCALATION = [60, 30, 14, 7, 1] as const

interface SogliaConfig {
  tipo: 'info' | 'warning' | 'critical'
  titolo: (numeroPratica: string) => string
}

const SOGLIA_CONFIG: Record<number, SogliaConfig> = {
  60: { tipo: 'info',     titolo: (n) => `Scadenza tra 2 mesi: ${n}` },
  30: { tipo: 'warning',  titolo: (n) => `Scadenza tra 1 mese: ${n}` },
  14: { tipo: 'critical', titolo: (n) => `Scadenza tra 14 giorni: ${n}` },
  7:  { tipo: 'critical', titolo: (n) => `URGENTE — Scadenza tra 7 giorni: ${n}` },
  1:  { tipo: 'critical', titolo: (n) => `URGENTISSIMO — Scadenza DOMANI: ${n}` },
  0:  { tipo: 'critical', titolo: (n) => `SCADENZA SUPERATA: ${n}` },
}

// ── DB row types (solo i campi effettivamente usati) ───────────────────────────

interface PraticaNorma {
  norma_codice: string
}

interface TrackingRecord {
  giorni_soglia: number
}

interface ClienteInfo {
  nome: string
}

interface PraticaPerEscalation {
  id: string
  numero_pratica: string
  assegnato_a: string | null
  data_scadenza: string
  fase: string
  clienti: ClienteInfo | null
  pratiche_norme: PraticaNorma[]
  notifiche_scadenza_inviate: TrackingRecord[]
}

interface PraticaOrfana {
  id: string
  numero_pratica: string
  completata_at: string | null
  assegnato_a: string | null
  created_by: string | null
  updated_by: string | null
  pratiche_norme: PraticaNorma[]
}

interface PromemoriaScaduto {
  id: string
  testo: string
  data_scadenza: string
  assegnato_a: string
  pratica_id: string | null
}

interface PromemoriaPerEscalation {
  id: string
  testo: string
  data_scadenza: string
  assegnato_a: string
  pratica_id: string | null
  pratiche: { numero_pratica: string; clienti: ClienteInfo | null } | null
  notifiche_promemoria_escalation: TrackingRecord[]
}

interface AdminProfile {
  id: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Differenza in giorni interi tra la data di scadenza e oggi (negativo = scaduto). */
function calcolaGiorniRimanenti(dataScadenzaStr: string): number {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const scadenza = new Date(dataScadenzaStr)
  scadenza.setHours(0, 0, 0, 0)
  return Math.floor((scadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
}

/** Formatta una data ISO in formato italiano leggibile. */
function formatData(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Costruisce il corpo della notifica di scadenza con contesto completo. */
function buildMessaggioScadenza(
  numeroPratica: string,
  clienteNome: string,
  norme: string[],
  fase: string,
  dataScadenza: string,
  giorni: number,
): string {
  const dataFmt  = formatData(dataScadenza)
  const normeStr = norme.length > 0 ? norme.join(', ') : '—'
  const faseLabel = fase.replace(/_/g, ' ')

  if (giorni <= 0) {
    return (
      `La pratica ${numeroPratica} del cliente "${clienteNome}" ha SUPERATO la data di scadenza` +
      ` (${dataFmt}).\nNorme: ${normeStr} | Fase corrente: ${faseLabel}`
    )
  }
  return (
    `La pratica ${numeroPratica} del cliente "${clienteNome}" scade il ${dataFmt}` +
    ` (tra ${giorni} giorni).\nNorme: ${normeStr} | Fase corrente: ${faseLabel}`
  )
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request): Promise<Response> => {
  const risultati = {
    parteA: { trovati: 0, creati: 0, errori: 0 },
    parteB: { pratiche: 0, notifiche_inviate: 0, errori: 0 },
    parteC: { promemoria_scaduti: 0, notifiche_inviate: 0, errori: 0 },
    parteD: { promemoria: 0, notifiche_inviate: 0, errori: 0 },
    eseguito_at: new Date().toISOString(),
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // ════════════════════════════════════════════════════════════════════════════
  // PARTE A — SAFETY NET PROMEMORIA ORFANI
  // Pratiche completate senza reminder sorveglianza.
  // ════════════════════════════════════════════════════════════════════════════

  try {
    const { data: orphans, error: orphanErr } = await supabase
      .from('pratiche')
      .select(`
        id,
        numero_pratica,
        completata_at,
        assegnato_a,
        created_by,
        updated_by,
        pratiche_norme(norma_codice)
      `)
      .eq('completata', true)
      .eq('sorveglianza_reminder_creato', false)

    if (orphanErr) throw orphanErr

    const list = (orphans ?? []) as PraticaOrfana[]
    risultati.parteA.trovati = list.length
    console.log(`[ParteA] Pratiche orfane trovate: ${list.length}`)

    for (const pratica of list) {
      try {
        // Logica identica al trigger on_pratica_completata (migration 012)
        const hasSA8000 = pratica.pratiche_norme.some(
          (n) => n.norma_codice === 'SA 8000',
        )
        const giorniScadenza = hasSA8000 ? 1095 : 365

        // Testo identico al trigger per coerenza con isAutoPromemoria() nel frontend
        const normeList = pratica.pratiche_norme
          .map((n) => n.norma_codice)
          .sort()
          .join(' + ') || '?'

        const testo =
          'Sorveglianza ' + normeList +
          ' per pratica ' + pratica.numero_pratica +
          ' — verificare scadenza ciclo certificativo' +
          (hasSA8000 ? ' (SA8000: ciclo 36 mesi)' : '')

        // creato_da: stessa priorità del trigger (COALESCE updated_by, created_by)
        const creatoDa = pratica.updated_by ?? pratica.created_by
        if (!creatoDa) {
          console.warn(
            `[ParteA] Pratica ${pratica.numero_pratica}: creato_da mancante — skip`,
          )
          risultati.parteA.errori++
          continue
        }

        const baseDate = pratica.completata_at
          ? new Date(pratica.completata_at)
          : new Date()
        const dataScadenza = new Date(baseDate)
        dataScadenza.setDate(dataScadenza.getDate() + giorniScadenza)

        // 1. Crea il promemoria
        const { error: createErr } = await supabase
          .from('promemoria')
          .insert({
            pratica_id:    pratica.id,
            creato_da:     creatoDa,
            assegnato_a:   pratica.assegnato_a ?? creatoDa,
            testo,
            data_scadenza: dataScadenza.toISOString().split('T')[0],
          })

        if (createErr) throw createErr

        // 2. Segna il reminder come creato (guard anti-duplicato)
        const { error: updateErr } = await supabase
          .from('pratiche')
          .update({ sorveglianza_reminder_creato: true })
          .eq('id', pratica.id)

        if (updateErr) throw updateErr

        risultati.parteA.creati++
        console.log(
          `[ParteA] Reminder creato: ${pratica.numero_pratica} (${giorniScadenza}gg)`,
        )
      } catch (err) {
        console.error(`[ParteA] Errore pratica ${pratica.numero_pratica}:`, err)
        risultati.parteA.errori++
      }
    }
  } catch (err) {
    console.error('[ParteA] Errore generale:', err)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PARTE B — NOTIFICHE ESCALATION SCADENZE
  // 5 livelli: 60 / 30 / 14 / 7 / 1 giorni + soglia 0 (scadenza superata).
  // ════════════════════════════════════════════════════════════════════════════

  try {
    // Admin da notificare per scadenze superate e pratiche senza assegnato_a
    const { data: adminsRaw, error: adminErr } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('ruolo', 'admin')
      .eq('attivo', true)

    if (adminErr) throw adminErr
    const adminIds = ((adminsRaw ?? []) as AdminProfile[]).map((a) => a.id)

    // Responsabili da notificare su tutte le soglie (insieme ad assegnato_a)
    const { data: responsabiliRaw, error: respErr } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('ruolo', 'responsabile')
      .eq('attivo', true)

    if (respErr) throw respErr
    const responsabileIds = ((responsabiliRaw ?? []) as AdminProfile[]).map((a) => a.id)

    // Pratiche attive, NON completate, con data_scadenza valorizzata + tracking già inviati.
    // .eq('completata', false) esclude pratiche con fase='completata' che hanno
    // ancora stato='attiva' — il lavoro è finito, non servono notifiche di scadenza.
    const { data: praticheRaw, error: praticheErr } = await supabase
      .from('pratiche')
      .select(`
        id,
        numero_pratica,
        assegnato_a,
        data_scadenza,
        fase,
        clienti!pratiche_cliente_id_fkey(nome),
        pratiche_norme(norma_codice),
        notifiche_scadenza_inviate(giorni_soglia)
      `)
      .eq('stato', 'attiva')
      .eq('completata', false)
      .not('data_scadenza', 'is', null)

    if (praticheErr) throw praticheErr

    const pratiche = (praticheRaw ?? []) as PraticaPerEscalation[]
    risultati.parteB.pratiche = pratiche.length
    console.log(`[ParteB] Pratiche da controllare: ${pratiche.length}`)

    for (const pratica of pratiche) {
      try {
        const giorni = calcolaGiorniRimanenti(pratica.data_scadenza)

        // Set di soglie già tracciate — impedisce re-invio in giorni successivi
        const soglieGiaInviate = new Set(
          pratica.notifiche_scadenza_inviate.map((r) => r.giorni_soglia),
        )

        const clienteNome = pratica.clienti?.nome ?? '—'
        const norme = pratica.pratiche_norme.map((n) => n.norma_codice)

        const messaggio = buildMessaggioScadenza(
          pratica.numero_pratica, clienteNome, norme, pratica.fase,
          pratica.data_scadenza, giorni,
        )

        // Destinatari base: assegnato_a + responsabili (dedup via Set)
        // Se assegnato_a manca → fallback admin
        const destinatariBase = [...new Set<string>([
          ...(pratica.assegnato_a ? [pratica.assegnato_a] : adminIds),
          ...responsabileIds,
        ])]

        // ── Soglie normali: 60, 30, 14, 7, 1 ──────────────────────────────
        for (const soglia of SOGLIE_ESCALATION) {
          if (giorni > soglia) continue       // non ancora in soglia
          if (soglieGiaInviate.has(soglia)) continue // già notificato

          const cfg = SOGLIA_CONFIG[soglia]

          for (const destId of destinatariBase) {
            const { error: notifErr } = await supabase
              .from('notifiche')
              .insert({
                destinatario_id: destId,
                pratica_id:      pratica.id,
                tipo:            cfg.tipo,
                titolo:          cfg.titolo(pratica.numero_pratica),
                messaggio,
              })
            if (notifErr) throw notifErr
          }

          // Traccia l'invio — ON CONFLICT DO NOTHING via upsert ignoreDuplicates
          const { error: trackErr } = await supabase
            .from('notifiche_scadenza_inviate')
            .upsert(
              { pratica_id: pratica.id, giorni_soglia: soglia },
              { onConflict: 'pratica_id,giorni_soglia', ignoreDuplicates: true },
            )
          if (trackErr) throw trackErr

          risultati.parteB.notifiche_inviate++
          console.log(
            `[ParteB] Notifica soglia ${soglia}gg → ${pratica.numero_pratica}`,
          )
        }

        // ── Soglia 0: scadenza superata → admin + responsabili + assegnato_a
        if (giorni <= 0 && !soglieGiaInviate.has(0)) {
          const cfg = SOGLIA_CONFIG[0]
          const destinatariScaduti = new Set<string>([
            ...adminIds,
            ...responsabileIds,
            ...(pratica.assegnato_a ? [pratica.assegnato_a] : []),
          ])

          for (const destId of destinatariScaduti) {
            const { error: notifErr } = await supabase
              .from('notifiche')
              .insert({
                destinatario_id: destId,
                pratica_id:      pratica.id,
                tipo:            cfg.tipo,
                titolo:          cfg.titolo(pratica.numero_pratica),
                messaggio,
              })
            if (notifErr) throw notifErr
          }

          const { error: trackErr } = await supabase
            .from('notifiche_scadenza_inviate')
            .upsert(
              { pratica_id: pratica.id, giorni_soglia: 0 },
              { onConflict: 'pratica_id,giorni_soglia', ignoreDuplicates: true },
            )
          if (trackErr) throw trackErr

          risultati.parteB.notifiche_inviate++
          console.log(
            `[ParteB] Notifica scadenza superata → ${pratica.numero_pratica}`,
          )
        }
      } catch (err) {
        console.error(
          `[ParteB] Errore pratica ${pratica.numero_pratica}:`, err,
        )
        risultati.parteB.errori++
      }
    }
  } catch (err) {
    console.error('[ParteB] Errore generale:', err)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PARTE C — PROMEMORIA SCADUTI
  // Notifica una volta al giorno per ogni promemoria scaduto non completato.
  // Dedup: controlla se esiste già una notifica con l'ID del promemoria
  // nel campo messaggio, creata nelle ultime 23 ore.
  // ════════════════════════════════════════════════════════════════════════════

  try {
    const oggiStr = new Date().toISOString().split('T')[0]
    const dedup24hAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

    const { data: scadutiRaw, error: scadutiErr } = await supabase
      .from('promemoria')
      .select('id, testo, data_scadenza, assegnato_a, pratica_id')
      .lte('data_scadenza', oggiStr)
      .eq('completato', false)
      .not('assegnato_a', 'is', null)

    if (scadutiErr) throw scadutiErr

    const scaduti = (scadutiRaw ?? []) as PromemoriaScaduto[]
    risultati.parteC.promemoria_scaduti = scaduti.length
    console.log(`[ParteC] Promemoria scaduti trovati: ${scaduti.length}`)

    for (const prom of scaduti) {
      try {
        // Dedup: cerca notifiche recenti che contengono l'ID di questo promemoria
        const { data: existing, error: existErr } = await supabase
          .from('notifiche')
          .select('id')
          .eq('destinatario_id', prom.assegnato_a)
          .ilike('messaggio', `%${prom.id}%`)
          .gte('created_at', dedup24hAgo)
          .limit(1)

        if (existErr) throw existErr
        if (existing && existing.length > 0) continue // già notificato nelle ultime 23h

        // Titolo troncato a 80 caratteri per leggibilità
        const testoTroncato = prom.testo.length > 80
          ? prom.testo.substring(0, 79) + '…'
          : prom.testo

        const { error: notifErr } = await supabase
          .from('notifiche')
          .insert({
            destinatario_id: prom.assegnato_a,
            pratica_id:      prom.pratica_id,
            tipo:            'warning',
            titolo:          `Promemoria scaduto: ${testoTroncato}`,
            // L'ID nel messaggio è usato per la deduplication nelle 23h successive
            messaggio:
              `Il promemoria "${prom.testo}" era in scadenza il` +
              ` ${formatData(prom.data_scadenza)}.\n[promemoria_id: ${prom.id}]`,
          })

        if (notifErr) throw notifErr
        risultati.parteC.notifiche_inviate++
        console.log(`[ParteC] Notifica promemoria scaduto: ${prom.id}`)
      } catch (err) {
        console.error(`[ParteC] Errore promemoria ${prom.id}:`, err)
        risultati.parteC.errori++
      }
    }
  } catch (err) {
    console.error('[ParteC] Errore generale:', err)
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PARTE D — ESCALATION PRE-SCADENZA PROMEMORIA
  // Stessa logica della Parte B ma applicata ai promemoria (sorveglianza e non).
  // Soglie: 60 / 30 / 14 / 7 / 1 giorni prima + 0 (scaduto).
  // Tracking via notifiche_promemoria_escalation (PK: promemoria_id, giorni_soglia).
  // ════════════════════════════════════════════════════════════════════════════

  try {
    // Admin (riusati dalla Parte B se già caricati, altrimenti caricati qui)
    let adminIdsD: string[]
    let responsabileIdsD: string[]
    try {
      // Ricarichiamo admin e responsabili — query leggere, evita variabili globali cross-scope
      const [adminsRes, respRes] = await Promise.all([
        supabase.from('user_profiles').select('id').eq('ruolo', 'admin').eq('attivo', true),
        supabase.from('user_profiles').select('id').eq('ruolo', 'responsabile').eq('attivo', true),
      ])

      if (adminsRes.error) throw adminsRes.error
      if (respRes.error) throw respRes.error
      adminIdsD = ((adminsRes.data ?? []) as AdminProfile[]).map((a) => a.id)
      responsabileIdsD = ((respRes.data ?? []) as AdminProfile[]).map((a) => a.id)
    } catch (err) {
      console.error('[ParteD] Errore caricamento admin/responsabili:', err)
      adminIdsD = []
      responsabileIdsD = []
    }

    // Promemoria non completati, con data_scadenza, con assegnato_a + tracking
    const { data: promRaw, error: promErr } = await supabase
      .from('promemoria')
      .select(`
        id,
        testo,
        data_scadenza,
        assegnato_a,
        pratica_id,
        pratiche(numero_pratica, clienti:clienti(nome)),
        notifiche_promemoria_escalation(giorni_soglia)
      `)
      .eq('completato', false)
      .not('data_scadenza', 'is', null)
      .not('assegnato_a', 'is', null)

    if (promErr) throw promErr

    const promemoria = (promRaw ?? []) as PromemoriaPerEscalation[]
    risultati.parteD.promemoria = promemoria.length
    console.log(`[ParteD] Promemoria da controllare: ${promemoria.length}`)

    for (const prom of promemoria) {
      try {
        const giorni = calcolaGiorniRimanenti(prom.data_scadenza)

        // Set di soglie già tracciate
        const soglieGiaInviate = new Set(
          prom.notifiche_promemoria_escalation.map((r) => r.giorni_soglia),
        )

        // Contesto per il messaggio
        const numeroPratica = prom.pratiche?.numero_pratica ?? '—'
        const clienteNome = prom.pratiche?.clienti?.nome ?? ''
        const testoTroncato = prom.testo.length > 80
          ? prom.testo.substring(0, 79) + '…'
          : prom.testo

        // Messaggio di notifica
        const dataFmt = formatData(prom.data_scadenza)
        const contestoPratica = numeroPratica !== '—'
          ? ` (pratica ${numeroPratica}${clienteNome ? ` — ${clienteNome}` : ''})`
          : ''

        const messaggio = giorni <= 0
          ? `Il promemoria "${prom.testo}" è SCADUTO il ${dataFmt}${contestoPratica}.`
          : `Il promemoria "${prom.testo}" scade il ${dataFmt} (tra ${giorni} giorni)${contestoPratica}.`

        // Destinatari base: assegnato_a + responsabili (dedup via Set)
        const destinatariBase = [...new Set<string>([
          prom.assegnato_a,
          ...responsabileIdsD,
        ])]

        // ── Soglie normali: 60, 30, 14, 7, 1 ──────────────────────────────
        for (const soglia of SOGLIE_ESCALATION) {
          if (giorni > soglia) continue
          if (soglieGiaInviate.has(soglia)) continue

          const tipoNotifica = soglia <= 7 ? 'critical' : soglia <= 30 ? 'warning' : 'info'
          const titoloPrefisso = soglia === 1
            ? 'URGENTISSIMO — Scadenza DOMANI'
            : soglia === 7
            ? `URGENTE — Scadenza tra ${soglia} giorni`
            : `Scadenza tra ${soglia <= 30 ? soglia + ' giorni' : '2 mesi'}`

          for (const destId of destinatariBase) {
            const { error: notifErr } = await supabase
              .from('notifiche')
              .insert({
                destinatario_id: destId,
                pratica_id:      prom.pratica_id,
                tipo:            tipoNotifica,
                titolo:          `${titoloPrefisso}: ${testoTroncato}`,
                messaggio,
              })
            if (notifErr) throw notifErr
          }

          // Traccia l'invio
          const { error: trackErr } = await supabase
            .from('notifiche_promemoria_escalation')
            .upsert(
              { promemoria_id: prom.id, giorni_soglia: soglia },
              { onConflict: 'promemoria_id,giorni_soglia', ignoreDuplicates: true },
            )
          if (trackErr) throw trackErr

          risultati.parteD.notifiche_inviate++
          console.log(
            `[ParteD] Notifica soglia ${soglia}gg → promemoria ${prom.id.substring(0, 8)}`,
          )
        }

        // ── Soglia 0: scaduto → admin + responsabili + assegnato_a ─────────
        if (giorni <= 0 && !soglieGiaInviate.has(0)) {
          const destinatariScaduti = new Set<string>([
            ...adminIdsD,
            ...responsabileIdsD,
            prom.assegnato_a,
          ])

          for (const destId of destinatariScaduti) {
            const { error: notifErr } = await supabase
              .from('notifiche')
              .insert({
                destinatario_id: destId,
                pratica_id:      prom.pratica_id,
                tipo:            'critical',
                titolo:          `PROMEMORIA SCADUTO: ${testoTroncato}`,
                messaggio,
              })
            if (notifErr) throw notifErr
          }

          const { error: trackErr } = await supabase
            .from('notifiche_promemoria_escalation')
            .upsert(
              { promemoria_id: prom.id, giorni_soglia: 0 },
              { onConflict: 'promemoria_id,giorni_soglia', ignoreDuplicates: true },
            )
          if (trackErr) throw trackErr

          risultati.parteD.notifiche_inviate++
          console.log(
            `[ParteD] Notifica scaduto → promemoria ${prom.id.substring(0, 8)}`,
          )
        }
      } catch (err) {
        console.error(`[ParteD] Errore promemoria ${prom.id}:`, err)
        risultati.parteD.errori++
      }
    }
  } catch (err) {
    console.error('[ParteD] Errore generale:', err)
  }

  // ── Riepilogo ──────────────────────────────────────────────────────────────
  console.log('[cron-scadenze] Completato:', JSON.stringify(risultati, null, 2))

  return new Response(JSON.stringify(risultati, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
