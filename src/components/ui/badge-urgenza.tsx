import { cn } from '@/lib/utils'
import { differenceInDays, parseISO } from 'date-fns'

interface BadgeUrgenzaProps {
  dataScadenza: string | null
  className?: string
}

function getUrgenzaConfig(giorni: number): {
  label: string
  className: string
  pulse: boolean
} {
  if (giorni < 0) {
    return {
      label: `Scaduta da ${Math.abs(giorni)}gg`,
      className: 'bg-red-500/20 text-red-300 border border-red-500/40',
      pulse: true,
    }
  }
  if (giorni < 15) {
    return {
      label: `${giorni}gg`,
      className: 'bg-red-500/15 text-red-400 border border-red-500/30',
      pulse: true,
    }
  }
  if (giorni <= 45) {
    return {
      label: `${giorni}gg`,
      className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      pulse: false,
    }
  }
  return {
    label: `${giorni}gg`,
    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    pulse: false,
  }
}

export function BadgeUrgenza({ dataScadenza, className }: BadgeUrgenzaProps) {
  if (!dataScadenza) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          'bg-slate-500/15 text-slate-400 border border-slate-500/30',
          className,
        )}
      >
        Nessuna scadenza
      </span>
    )
  }

  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const giorni = differenceInDays(parseISO(dataScadenza), oggi)
  const config = getUrgenzaConfig(giorni)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        config.pulse && 'animate-pulse',
        className,
      )}
    >
      {config.pulse && giorni < 15 && (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {config.label}
    </span>
  )
}
