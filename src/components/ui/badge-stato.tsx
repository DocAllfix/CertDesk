import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'

type StatoPraticaType = Enums<'stato_pratica_type'>

interface BadgeStatoProps {
  stato: StatoPraticaType
  className?: string
}

const STATO_CONFIG: Record<
  StatoPraticaType,
  { label: string; className: string; strikethrough?: boolean }
> = {
  attiva: {
    label: 'Attiva',
    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  sospesa: {
    label: 'Sospesa',
    className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
  annullata: {
    label: 'Annullata',
    className: 'bg-red-500/15 text-red-400 border border-red-500/30',
    strikethrough: true,
  },
}

export function BadgeStato({ stato, className }: BadgeStatoProps) {
  const config = STATO_CONFIG[stato]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      <span className={cn(config.strikethrough && 'line-through')}>
        {config.label}
      </span>
    </span>
  )
}
