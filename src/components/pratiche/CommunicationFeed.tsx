/**
 * CommunicationFeed — feed comunicazioni di una pratica.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/CommunicationFeed.jsx
 * Layout: composer in alto, timeline sotto (messaggi più recenti in cima).
 *
 * Dati reali: messaggi_interni via useMessaggiPratica + useSendMessaggio.
 * Realtime: canale Supabase attivo finché il componente è montato.
 */
import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Send, ArrowRight, MessageSquare, Paperclip, Tag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Button }     from '@/components/ui/button'
import { Textarea }   from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useMessaggiPratica, useSendMessaggio } from '@/hooks/useMessaggiInterni'
import { getTeamMembers } from '@/lib/queries/messaggi'
import { useAuth } from '@/hooks/useAuth'
import type { MessaggioConRelazioni, MessaggioTipo } from '@/types/app.types'

// ── Costanti visual (speculari a evalisdesk CommunicationFeed.jsx) ──

type FeedItemVisualType = 'system' | 'message'

const TYPE_COLORS: Record<FeedItemVisualType, string> = {
  system:  'bg-primary/10 text-primary',
  message: 'bg-secondary/10 text-secondary',
}

const TYPE_ICONS: Record<FeedItemVisualType, React.ElementType> = {
  system:  ArrowRight,
  message: MessageSquare,
}

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

// Valore sentinella per "nessun destinatario" nel Select di Shadcn
const DEST_TUTTI = '__tutti__'

// ── Helpers ───────────────────────────────────────────────────────

function fmtData(d: string | null | undefined): string {
  if (!d) return ''
  try {
    return format(new Date(d), "d MMM yyyy, HH:mm", { locale: it })
  } catch {
    return d
  }
}

function nomeCompleto(
  u: { nome: string | null; cognome: string | null } | null | undefined,
): string {
  if (!u) return '—'
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '—'
}

// ── Componente ────────────────────────────────────────────────────

interface CommunicationFeedProps {
  praticaId: string
}

export function CommunicationFeed({ praticaId }: CommunicationFeedProps) {
  const { user } = useAuth()

  const [testo, setTesto]   = useState('')
  const [tipo,  setTipo]    = useState<MessaggioTipo>('commento')
  const [dest,  setDest]    = useState<string>(DEST_TUTTI)
  const textareaRef         = useRef<HTMLTextAreaElement>(null)

  // ── Data ────────────────────────────────────────────────────────

  const { data: messaggi = [], isLoading } = useMessaggiPratica(praticaId)

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn:  getTeamMembers,
    staleTime: 5 * 60_000,
  })

  const send = useSendMessaggio(praticaId)

  // ── Handlers ────────────────────────────────────────────────────

  const handleSend = () => {
    const testoTrimmed = testo.trim()
    if (!testoTrimmed) return

    send.mutate(
      {
        testo:          testoTrimmed,
        tipo,
        destinatarioId: dest !== DEST_TUTTI ? dest : null,
      },
      {
        onSuccess: () => {
          setTesto('')
          setDest(DEST_TUTTI)
          setTipo('commento')
          textareaRef.current?.focus()
        },
      },
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Feed item renderer ──────────────────────────────────────────

  const renderItem = (msg: MessaggioConRelazioni) => {
    const isSistema    = msg.tipo === 'sistema'
    const visualType: FeedItemVisualType = isSistema ? 'system' : 'message'
    const Icon         = TYPE_ICONS[visualType]
    const colorClass   = TYPE_COLORS[visualType]
    const autoreNome   = nomeCompleto(msg.autore)
    const destNome     = msg.destinatario ? nomeCompleto(msg.destinatario) : null

    return (
      <div key={msg.id} className="flex gap-3.5 relative">
        {/* Icona cerchio */}
        <div
          className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center shrink-0 z-10`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        {/* Contenuto */}
        <div className="min-w-0 pt-1 flex-1">
          {/* Intestazione */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{autoreNome}</span>

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
          {isSistema ? (
            <p className="text-sm text-muted-foreground mt-0.5">{msg.testo}</p>
          ) : (
            <p className="text-sm text-foreground mt-1 bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
              {msg.testo}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Comunicazioni</h3>
      </div>

      <div className="p-5">
        {/* ── Composer ── */}
        <div className="space-y-2 mb-6">
          {/* Riga 1: tipo + destinatario */}
          <div className="flex gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as MessaggioTipo)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <Tag className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="commento">Commento</SelectItem>
                <SelectItem value="richiesta">Richiesta</SelectItem>
                <SelectItem value="risposta">Risposta</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dest} onValueChange={setDest}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Destinatario (opz.)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEST_TUTTI}>Tutti</SelectItem>
                {teamMembers
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {nomeCompleto(m)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Riga 2: textarea + invio */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                placeholder="Scrivi un commento… (Ctrl+Invio per inviare)"
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[72px] bg-muted/30 border-border resize-none pr-10"
                disabled={send.isPending}
              />
              <button
                type="button"
                className="absolute right-3 bottom-3 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Allega file (non disponibile)"
                disabled
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            <Button
              size="icon"
              className="bg-primary hover:bg-primary/90 self-end h-10 w-10"
              onClick={handleSend}
              disabled={!testo.trim() || send.isPending}
              aria-label="Invia messaggio"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Timeline ── */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Caricamento comunicazioni…
          </p>
        ) : messaggi.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nessuna comunicazione ancora. Scrivi il primo messaggio.
          </p>
        ) : (
          <div className="relative">
            {/* Linea verticale della timeline */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-5">
              {/* Messaggi in ordine inverso: più recente in cima */}
              {[...messaggi].reverse().map(renderItem)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
