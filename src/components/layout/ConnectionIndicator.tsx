/**
 * ConnectionIndicator — mostra lo stato della connessione internet.
 * Ref: ../evalisdesk-ref/src/components/layout/ConnectionIndicator.jsx
 */
import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Status = 'connected' | 'reconnecting' | 'offline'

interface StatusConfig {
  label: string
  dotClass: string
  textClass: string
  icon: React.ElementType
}

const STATUS_CONFIG: Record<Status, StatusConfig> = {
  connected:    { label: 'Connesso',        dotClass: 'bg-success',                    textClass: 'text-success',     icon: Wifi      },
  reconnecting: { label: 'Riconnessione...', dotClass: 'bg-warning animate-pulse',     textClass: 'text-warning',     icon: RefreshCw },
  offline:      { label: 'Offline',         dotClass: 'bg-destructive',                textClass: 'text-destructive', icon: WifiOff   },
}

interface ConnectionIndicatorProps {
  collapsed: boolean
}

export function ConnectionIndicator({ collapsed }: ConnectionIndicatorProps) {
  const [status, setStatus] = useState<Status>('connected')

  useEffect(() => {
    const handleOffline = () => setStatus('offline')
    const handleOnline  = () => setStatus('connected')
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
    }
  }, [])

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
