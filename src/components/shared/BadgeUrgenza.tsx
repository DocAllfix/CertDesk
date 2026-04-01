/**
 * BadgeUrgenza — badge scadenza con livello di urgenza calcolato.
 * Visual: traslucido con colore semantico (Evalisdesk pattern)
 * Ref: ../evalisdesk-ref/src/components/shared/UrgencyBadge.jsx
 */
import { cn } from '@/lib/utils'
import { differenceInDays, parseISO } from 'date-fns'

interface BadgeUrgenzaProps {
  dataScadenza: string | null
  className?: string
}

type UrgencyLevel = 'critical' | 'warning' | 'ok' | 'none'

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  warning:  'bg-warning/10 text-warning border-warning/20',
  ok:       'bg-success/10 text-success border-success/20',
  none:     'bg-muted text-muted-foreground border-border',
}

function calcUrgenza(dataScadenza: string): { level: UrgencyLevel; label: string } {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const giorni = differenceInDays(parseISO(dataScadenza), oggi)

  if (giorni < 0)   return { level: 'critical', label: 'Scaduta' }
  if (giorni <= 15) return { level: 'critical', label: `${giorni}g` }
  if (giorni <= 45) return { level: 'warning',  label: `${giorni}g` }
  return               { level: 'ok',       label: `${giorni}g` }
}

export function BadgeUrgenza({ dataScadenza, className }: BadgeUrgenzaProps) {
  if (!dataScadenza) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border',
          URGENCY_STYLES.none,
          className,
        )}
      >
        —
      </span>
    )
  }

  const { level, label } = calcUrgenza(dataScadenza)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border',
        URGENCY_STYLES[level],
        className,
      )}
    >
      {label}
    </span>
  )
}
