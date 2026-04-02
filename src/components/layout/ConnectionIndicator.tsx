/**
 * ConnectionIndicator — stato connessione WebSocket Supabase Realtime.
 * Ref: ../evalisdesk-ref/src/components/layout/ConnectionIndicator.jsx
 *
 * Legge useRealtimeStatus() → pallino verde/arancio/rosso in sidebar.
 *   connected    → verde     (WebSocket attivo)
 *   connecting   → giallo    (in attesa connessione iniziale)
 *   reconnecting → arancio lampeggiante (WebSocket caduto)
 *   polling      → arancio   (fallback polling attivo)
 *   error        → rosso     (errore permanente)
 */
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRealtimeStatus, type RealtimeConnectionStatus } from '@/hooks/useRealtimeStatus'

// ── Config stato → stile ─────────────────────────────────────────

interface StatusConfig {
  label:     string
  dotClass:  string
  textClass: string
  Icon:      React.ElementType
}

const STATUS_CONFIG: Record<RealtimeConnectionStatus, StatusConfig> = {
  connected:    { label: 'Connesso',          dotClass: 'bg-success',              textClass: 'text-success',     Icon: Wifi      },
  connecting:   { label: 'Connessione...',    dotClass: 'bg-warning animate-pulse', textClass: 'text-warning',    Icon: RefreshCw },
  reconnecting: { label: 'Riconnessione...', dotClass: 'bg-warning animate-pulse', textClass: 'text-warning',     Icon: RefreshCw },
  polling:      { label: 'Polling attivo',   dotClass: 'bg-warning',               textClass: 'text-warning',     Icon: RefreshCw },
  error:        { label: 'Disconnesso',      dotClass: 'bg-destructive',           textClass: 'text-destructive', Icon: WifiOff   },
}

// ── Props ─────────────────────────────────────────────────────────

interface ConnectionIndicatorProps {
  collapsed: boolean
}

// ── Componente ────────────────────────────────────────────────────

export function ConnectionIndicator({ collapsed }: ConnectionIndicatorProps) {
  const status = useRealtimeStatus()
  const { label, dotClass, textClass } = STATUS_CONFIG[status]

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-center py-1">
            <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
      <span className={`text-xs ${textClass}`}>{label}</span>
    </div>
  )
}
