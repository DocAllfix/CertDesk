/**
 * CertDesk — Tipi Applicativi
 *
 * Questi tipi estendono i tipi DB auto-generati (database.types.ts)
 * con le relazioni e le strutture usate nel frontend.
 *
 * REGOLA: mai usare `any`. Ogni tipo è derivato da Database.
 */

import type { Tables, DbEnum } from '@/lib/supabase'

// ── Alias di base (re-export per comodità) ──────────────────────

export type UserProfile = Tables<'user_profiles'>
export type Cliente = Tables<'clienti'>
export type Consulente = Tables<'consulenti'>
export type Pratica = Tables<'pratiche'>
export type Allegato = Tables<'allegati'>
export type StoricoFase = Tables<'storico_fasi'>
export type Notifica = Tables<'notifiche'>
export type MessaggioInterno = Tables<'messaggi_interni'>
export type Promemoria = Tables<'promemoria'>
export type NormaCatalogo = Tables<'norme_catalogo'>

/** Audit Integrato — definito manualmente finché database.types.ts non viene rigenerato */
export interface AuditIntegrato {
  id: string
  numero_audit: string | null
  cliente_id: string
  note: string | null
  created_at: string | null
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
}

// ── Enum aliases ────────────────────────────────────────────────

export type UserRole = DbEnum<'user_role'>
export type CicloType = DbEnum<'ciclo_type'>
export type FaseType = DbEnum<'fase_type'>
export type StatoPraticaType = DbEnum<'stato_pratica_type'>
export type ContattoType = DbEnum<'contatto_type'>
export type NotificaTipo = DbEnum<'notifica_tipo'>
export type MessaggioTipo = DbEnum<'messaggio_tipo'>

// ── Tipi con Relazioni ──────────────────────────────────────────

/** Dati minimi audit per badge/riferimento sulle pratiche */
export interface AuditIntegratoRef {
  id: string
  numero_audit: string
}

/** Pratica con tutte le relazioni necessarie per lista e dettaglio */
export interface PraticaConRelazioni extends Pratica {
  cliente: Cliente
  consulente: Consulente | null
  assegnato: UserProfile | null
  auditor: UserProfile | null
  created_by_profile: UserProfile | null
  updated_by_profile: UserProfile | null
  norme: NormaCatalogo[]
  audit: AuditIntegratoRef | null
}

/** Pratica con dati minimi per lista/tabella (performance) */
export interface PraticaListItem extends Pratica {
  cliente: Pick<Cliente, 'id' | 'nome' | 'ragione_sociale'>
  consulente: Pick<Consulente, 'id' | 'nome' | 'cognome'> | null
  assegnato: Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url'> | null
  norme: Pick<NormaCatalogo, 'codice' | 'nome'>[]
  audit: AuditIntegratoRef | null
}

/** Audit integrato con pratiche figlie e dati derivati (dalla view vw_audit_integrati) */
export interface AuditIntegratoConPratiche extends AuditIntegrato {
  cliente: Pick<Cliente, 'id' | 'nome' | 'ragione_sociale'>
  pratiche: PraticaListItem[]
  pratiche_totali: number
  pratiche_completate: number
  is_completato: boolean
  prima_scadenza: string | null
}

/** Riga dalla view vw_audit_integrati (senza pratiche dettagliate) */
export interface AuditIntegratoView extends AuditIntegrato {
  pratiche_totali: number
  pratiche_completate: number
  is_completato: boolean
  pratiche_attive: number
  prima_scadenza: string | null
  ultima_scadenza: string | null
  ha_archiviate: boolean
}

/** Input per il wizard di creazione audit integrato */
export interface CreaAuditIntegratoInput {
  cliente_id: string
  ciclo: CicloType
  tipo_contatto: ContattoType
  consulente_id?: string | null
  referente_nome?: string | null
  referente_email?: string | null
  referente_tel?: string | null
  note?: string | null
  pratiche: CreaAuditPraticaInput[]
}

/** Dati per singola pratica dentro il wizard audit */
export interface CreaAuditPraticaInput {
  norma_codice: string
  assegnato_a?: string | null
  auditor_id?: string | null
  data_verifica?: string | null
  data_scadenza?: string | null
  sede_verifica?: string | null
}

/** Profilo utente con le norme di competenza (per responsabili) */
export interface UserProfileCompleto extends UserProfile {
  norme_competenza: NormaCatalogo[]
}

/** Notifica con dati della pratica associata */
export interface NotificaConPratica extends Notifica {
  pratica: Pick<Pratica, 'id' | 'numero_pratica' | 'fase' | 'stato'> | null
  mittente: Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url'> | null
}

/** Messaggio con dati autore e allegato */
export interface MessaggioConRelazioni extends MessaggioInterno {
  autore: Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url'>
  destinatario: Pick<UserProfile, 'id' | 'nome' | 'cognome'> | null
  allegato: Allegato | null
}

/** Allegato con dati di chi lo ha caricato */
export interface AllegatoConCaricatoDa extends Allegato {
  caricato_da_profile: Pick<UserProfile, 'id' | 'nome' | 'cognome'> | null
}

/** Storico fase con dati di chi ha effettuato il cambio */
export interface StoricoFaseConUtente extends StoricoFase {
  cambiato_da_profile: Pick<UserProfile, 'id' | 'nome' | 'cognome'> | null
}

/** Promemoria con dati pratica e utenti */
export interface PromemoriaConRelazioni extends Promemoria {
  pratica: Pick<Pratica, 'id' | 'numero_pratica' | 'fase' | 'stato'> | null
  creato_da_profile: Pick<UserProfile, 'id' | 'nome' | 'cognome'> | null
  assegnato_a_profile: Pick<UserProfile, 'id' | 'nome' | 'cognome'> | null
}

// ── Dashboard e Statistiche ─────────────────────────────────────

/** Risposta di get_statistiche_dashboard() */
export interface StatisticheDashboard {
  totale_attive: number
  per_fase: Record<FaseType, number>
  per_ciclo: Record<CicloType, number>
  scadenze_30gg: number
  scadenze_15gg: number
  completate_mese: number
  sospese: number
  promemoria_attivi: number
  notifiche_non_lette: number
}

// ── Filtri e Ricerca ────────────────────────────────────────────

/** Filtri applicabili alla lista pratiche */
export interface FiltriPratiche {
  /** Testo libero: cerca in numero_pratica, cliente.nome, note */
  ricerca?: string
  /** Filtra per fase corrente */
  fase?: FaseType | null
  /** Filtra per stato pratica */
  stato?: StatoPraticaType | null
  /** Filtra per ciclo */
  ciclo?: CicloType | null
  /** Filtra per utente assegnato (UUID) */
  assegnato_a?: string | null
  /** Filtra per cliente (UUID) */
  cliente_id?: string | null
  /** Filtra per norma (codice) */
  norma_codice?: string | null
  /** Filtra per priorità (0=normale, 1=alta, 2=urgente) */
  priorita?: number | null
  /** Filtra per audit integrato (UUID) */
  audit_integrato_id?: string | null
  /** Mostra anche pratiche archiviate */
  includi_archiviate?: boolean
  /** Mostra SOLO pratiche archiviate */
  solo_archiviate?: boolean
  /** Filtra pratiche con data_scadenza ≤ questa data (formato ISO: 'YYYY-MM-DD') */
  scadenza_max?: string | null
  /** Shortcut: filtra solo pratiche con stato = 'attiva' (ha precedenza su stato) */
  solo_attive?: boolean
  /** Ordinamento */
  ordinamento?: OrdinamentoPratiche
  /** Direzione ordinamento */
  direzione?: 'asc' | 'desc'
}

/** Campi disponibili per ordinamento pratiche */
export type OrdinamentoPratiche =
  | 'numero_pratica'
  | 'created_at'
  | 'updated_at'
  | 'data_scadenza'
  | 'priorita'
  | 'fase'
  | 'stato'
  | 'cliente_nome'

/** Filtri per lista clienti */
export interface FiltriClienti {
  ricerca?: string
  attivo?: boolean | null
}

/** Filtri per lista consulenti */
export interface FiltriConsulenti {
  ricerca?: string
  attivo?: boolean | null
  norma_codice?: string | null
}

// ── Workflow e Transizioni ───────────────────────────────────────

/** Informazioni su una transizione di fase */
export interface TransizioneFase {
  fase_corrente: FaseType
  fase_successiva: FaseType | null
  fase_precedente: FaseType | null
  puo_avanzare: boolean
  puo_retrocedere: boolean
  motivo_blocco: string | null
  prerequisiti_mancanti: string[]
}

/** Mappa delle fasi con label e ordine per UI */
export interface FaseInfo {
  valore: FaseType
  label: string
  ordine: number
  descrizione: string
  colore: string
}

// ── Paginazione ─────────────────────────────────────────────────

export interface PaginazioneParams {
  pagina: number
  per_pagina: number
}

export interface RisultatoPaginato<T> {
  dati: T[]
  totale: number
  pagina: number
  per_pagina: number
  totale_pagine: number
}
