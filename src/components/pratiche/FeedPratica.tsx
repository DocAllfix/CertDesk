/**
 * FeedPratica — feed cronologico unificato della pratica.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/CommunicationFeed.jsx
 *
 * Mostra in unica timeline ordinata per created_at (più recente in cima):
 *   - Messaggi utenti (commento / richiesta) con avatar iniziali colorate,
 *     badge tipo, testo, destinatario, allegato scaricabile
 *   - Eventi sistema dal log storico_fasi (cambio fase, ecc.)
 *     in stile tenue con icona ArrowRight
 *
 * Real-time: nuovi messaggi appaiono senza refresh (useMessaggiPratica).
 */
import { useQuery }   from '@tanstack/react-query'
import { format }     from 'date-fns'
import { it }         from 'date-fns/locale'
import { toast }      from 'sonner'
import {
  ArrowRight,
  MessageSquare,
  Paperclip,
  Download,
} from 'lucide-react'

import { InviaMessaggioForm }       from './InviaMessaggioForm'
import { useMessaggiPratica }       from '@/hooks/useMessaggiInterni'
import { getStoricoFasiPratica }    from '@/lib/queries/messaggi'
import { downloadAllegato }         from '@/lib/storage/allegati'
import type {
  MessaggioConRelazioni,
  MessaggioTipo,
  StoricoFaseConUtente,
  FaseType,
} from '@/types/app.types'

// ── Label fasi ────────────────────────────────────────────────────

const FASE_LABELS: Record<FaseType, string> = {
  contratto_firmato:       'Contratto Firmato',
  programmazione_verifica: 'Programmazione Verifica',
  richiesta_proforma:      'Richiesta Proforma',
  elaborazione_pratica:    'Elaborazione Pratica',
  firme:                   'Firme',
  invio_firme:             'Invio Firme',
  completata:              'Completata',
}

// ── Colori badge tipo messaggio ───────────────────────────────────

const TIPO_COLORS: Record<MessaggioTipo, string> = {
  richiesta: 'bg-warning/10 text-warning border-warning/20',
  commento:  'bg-muted text-muted-foreground border-border',
  risposta:  'bg-primary/10 text-primary border-primary/20',
  sistema:   'bg-muted/50 text-muted-foreground border-border',
}

const TIPO_LABELS: Record<MessaggioTipo, string> = {
  commento:  'Commento',
  richiesta: 'Richiesta',
  risposta:  'Risposta',
  sistema:   'Sistema',
}

// ── Colori avatar (deterministici per userId) ─────────────────────

const AVATAR_COLORS = [
  'bg-blue-500/15 text-blue-400',
  'bg-violet-500/15 text-violet-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-amber-500/15 text-amber-400',
  'bg-rose-500/15 text-rose-400',
  'bg-cyan-500/15 text-cyan-400',
]

function avatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash]
}

// ── Tipo unificato per la timeline ────────────────────────────────

type FeedItem =
  | { kind: 'messaggio'; data: MessaggioConRelazioni; ts: string }
  | { kind: 'sistema';   data: StoricoFaseConUtente;  ts: string }

// ── Helpers ───────────────────────────────────────────────────────

function fmtData(d: string | null | undefined): string {
  if (!d) return ''
  try { return format(new Date(d), "d MMM yyyy, HH:mm", { locale: it }) }
  catch { return d }
}

function nomeCompleto(
  u: { nome: string | null; cognome: string | null } | null | undefined,
): string {
  if (!u) return '—'
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '—'
}

function iniziali(
  u: { nome: string | null; cognome: string | null } | null | undefined,
): string {
  if (!u) return '?'
  const n = u.nome?.[0] ?? ''
  const c = u.cognome?.[0] ?? ''
  return (n + c).toUpperCase() || '?'
}

function buildSistemaText(item: StoricoFaseConUtente): string {
  const nome = item.cambiato_da_profile
    ? nomeCompleto(item.cambiato_da_profile)
    : 'Sistema'

  if (!item.fase_precedente) {
    return `${nome} ha creato la pratica in fase ${FASE_LABELS[item.fase_nuova]}`
  }
  if (item.fase_nuova === 'completata') {
    return `${nome} ha completato la pratica`
  }
  return `${nome} ha avanzato la pratica a ${FASE_LABELS[item.fase_nuova]}`
}

// ── Props ─────────────────────────────────────────────────────────

interface FeedPraticaProps {
  praticaId: string
}

// ── Componente ────────────────────────────────────────────────────

export function FeedPratica({ praticaId }: FeedPraticaProps) {
  // ── Data ──────────────────────────────────────────────────────

  const { data: messaggi = [], isLoading: loadingMsg } = useMessaggiPratica(praticaId)

  const { data: storico = [], isLoading: loadingStoico } = useQuery({
    queryKey:  ['storico-fasi', praticaId],
    queryFn:   () => getStoricoFasiPratica(praticaId),
    staleTime: 60_000,
  })

  // ── Merge e sort ──────────────────────────────────────────────

  const feed: FeedItem[] = [
    ...messaggi.map((m): FeedItem => ({
      kind: 'messaggio',
      data: m,
      ts:   m.created_at ?? '',
    })),
    ...storico.map((s): FeedItem => ({
      kind: 'sistema',
      data: s,
      ts:   s.created_at ?? '',
    })),
  ].sort((a, b) => a.ts.localeCompare(b.ts))

  // ── Download allegato ─────────────────────────────────────────

  const handleDownload = async (allegatoId: string) => {
    try {
      const url = await downloadAllegato(allegatoId)
      window.open(url, '_blank')
    } catch {
      toast.error('Errore nel download del file')
    }
  }

  // ── Render item messaggio ─────────────────────────────────────

  const renderMessaggio = (msg: MessaggioConRelazioni) => {
    const autore     = msg.autore
    const isSistema  = msg.tipo === 'sistema'
    const colorClass = avatarColor(autore.id)
    const destNome   = msg.destinatario ? nomeCompleto(msg.destinatario) : null

    return (
      <div key={msg.id} className="flex gap-3.5 relative">
        {/* Avatar con iniziali */}
        <div
          className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center shrink-0 z-10 text-xs font-semibold`}
        >
          {iniziali(autore)}
        </div>

        <div className="min-w-0 pt-1 flex-1">
          {/* Intestazione */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{nomeCompleto(autore)}</span>

            {!isSistema && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TIPO_COLORS[msg.tipo]}`}
              >
                {TIPO_LABELS[msg.tipo]}
              </span>
            )}

            {destNome && (
              <span className="text-xs text-muted-foreground">→ {destNome}</span>
            )}

            <span className="text-xs text-muted-foreground">{fmtData(msg.created_at)}</span>
          </div>

          {/* Testo */}
          <p className="text-sm text-foreground mt-1 bg-muted/30 rounded-lg px-3 py-2 border border-border/50 whitespace-pre-wrap">
            {msg.testo}
          </p>

          {/* Allegato scaricabile */}
          {msg.allegato && (
            <button
              type="button"
              onClick={() => handleDownload(msg.allegato!.id)}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="truncate max-w-[200px]">{msg.allegato.nome_originale}</span>
              <Download className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Render item sistema ───────────────────────────────────────

  const renderSistema = (item: StoricoFaseConUtente) => (
    <div key={item.id} className="flex gap-3.5 relative">
      {/* Icona sistema */}
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 z-10">
        <ArrowRight className="w-3.5 h-3.5" />
      </div>

      <div className="min-w-0 pt-1 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">{buildSistemaText(item)}</span>
          <span className="text-xs text-muted-foreground/60">{fmtData(item.created_at)}</span>
        </div>
        {item.motivo && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 italic">"{item.motivo}"</p>
        )}
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────

  const isLoading = loadingMsg || loadingStoico

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Comunicazioni</h3>
      </div>

      <div className="p-5">
        {/* Composer — in alto, come da evalisdesk */}
        <div className="mb-6">
          <InviaMessaggioForm praticaId={praticaId} />
        </div>

        {/* Timeline */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Caricamento comunicazioni…
          </p>
        ) : feed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nessuna comunicazione ancora. Scrivi il primo messaggio.
          </p>
        ) : (
          <div className="relative">
            {/* Linea verticale della timeline */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-5">
              {/* Più recente in cima */}
              {[...feed].reverse().map((item) =>
                item.kind === 'messaggio'
                  ? renderMessaggio(item.data)
                  : renderSistema(item.data),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
