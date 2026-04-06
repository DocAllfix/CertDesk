/**
 * NotifichePanel — pannello notifiche slide-over da destra.
 * Ref: ../evalisdesk-ref/src/components/layout/NotificationPanel.jsx
 *
 * Design identico a Evalisdesk: slide-over w-[400px] da destra,
 * backdrop blur, header con tabs, SearchInput, scroll area.
 */
import { useState, memo } from 'react'
import { Link } from 'react-router-dom'
import {
  X, Bell, CheckCheck, Search, Settings,
  AlertTriangle, ArrowRight, FileText, MessageSquare, Info,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'

import { Button }     from '@/components/ui/button'
import { Input }      from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useNotifiche,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/hooks/useNotifiche'

import type { NotificaTipo } from '@/types/app.types'

// ── Mappa tipo → icona + colori (pattern Evalisdesk TYPE_CONFIG) ─

interface TipoConfig {
  Icon:  React.ElementType
  color: string
  bg:    string
}

const TIPO_CONFIG: Record<NotificaTipo, TipoConfig> = {
  critical:  { Icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/15' },
  warning:   { Icon: AlertTriangle, color: 'text-warning',     bg: 'bg-warning/15'     },
  richiesta: { Icon: FileText,      color: 'text-primary',     bg: 'bg-primary/15'     },
  success:   { Icon: ArrowRight,    color: 'text-success',     bg: 'bg-success/15'     },
  info:      { Icon: Info,          color: 'text-secondary',   bg: 'bg-secondary/15'   },
  sistema:   { Icon: MessageSquare, color: 'text-muted-foreground', bg: 'bg-muted'     },
}

const TABS = ['Tutti', 'Non lette', 'Critiche'] as const
type Tab = (typeof TABS)[number]

// ── Helper ────────────────────────────────────────────────────────

function fmtRelativo(d: string | null): string {
  if (!d) return ''
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true, locale: it })
  } catch {
    return ''
  }
}

// ── Props ─────────────────────────────────────────────────────────

interface NotifichePanelProps {
  open:    boolean
  onClose: () => void
}

// ── Componente ────────────────────────────────────────────────────

export const NotifichePanel = memo(function NotifichePanel({ open, onClose }: NotifichePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Tutti')
  const [ricerca,   setRicerca]   = useState('')

  const { data: notifiche = [], isLoading } = useNotifiche()
  const markAsRead    = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  if (!open) return null

  // ── Filtraggio ────────────────────────────────────────────────

  const nonLette = notifiche.filter(n => !n.letta).length

  const filtrate = notifiche.filter(n => {
    if (activeTab === 'Non lette' && n.letta) return false
    if (activeTab === 'Critiche'  && n.tipo !== 'critical' && n.tipo !== 'richiesta') return false
    if (ricerca) {
      const q = ricerca.toLowerCase()
      return (
        n.titolo.toLowerCase().includes(q) ||
        n.messaggio.toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Handlers ─────────────────────────────────────────────────

  const handleClickNotifica = (id: string, letta: boolean | null) => {
    if (!letta) markAsRead.mutate(id)
    onClose()
  }

  const handleMarkAll = () => {
    if (nonLette > 0) markAllAsRead.mutate()
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />

      {/* Panel — identico a Evalisdesk: right-0, w-[400px], h-screen */}
      <div className="fixed right-0 top-0 h-screen w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground font-poppins">Notifiche</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-muted-foreground hover:text-foreground"
                title="Impostazioni notifiche"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-muted-foreground hover:text-foreground"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Ricerca */}
          <div className="relative mt-3 mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca notifiche..."
              value={ricerca}
              onChange={e => setRicerca(e.target.value)}
              className="pl-8 h-8 bg-muted/40 border-border/60 text-xs"
            />
          </div>
        </div>

        {/* Toolbar: contatore + "segna tutte lette" */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-border/40 shrink-0">
          <span className="text-xs text-muted-foreground">
            {nonLette > 0 ? `${nonLette} non lette` : 'Tutto letto'}
          </span>
          <button
            onClick={handleMarkAll}
            disabled={nonLette === 0 || markAllAsRead.isPending}
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Segna tutte lette
          </button>
        </div>

        {/* Lista notifiche — ScrollArea */}
        <ScrollArea className="flex-1">
          <div className="py-2">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}

            {!isLoading && filtrate.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Bell className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {ricerca ? 'Nessun risultato' : 'Nessuna notifica'}
                </p>
                {!ricerca && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Le nuove notifiche appariranno qui in tempo reale
                  </p>
                )}
              </div>
            )}

            {!isLoading && filtrate.map(n => {
              const cfg  = TIPO_CONFIG[n.tipo]
              const Icon = cfg.Icon
              const isUnread = !n.letta

              return (
                <Link
                  key={n.id}
                  to={n.azione_url ?? (n.pratica_id ? `/pratiche/${n.pratica_id}` : '#')}
                  onClick={() => handleClickNotifica(n.id, n.letta)}
                  className={`flex gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50 border-b border-border/30 last:border-0 ${
                    isUnread ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Icona tipo */}
                  <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Contenuto */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold truncate ${
                        isUnread ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {n.titolo}
                      </p>
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {n.messaggio}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">
                      {fmtRelativo(n.created_at)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  )
})
