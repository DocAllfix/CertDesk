/**
 * BadgeStato — badge per stato_pratica_type PostgreSQL.
 * Componente CertDesk-specifico (non esiste in Evalisdesk).
 * Visual: pattern traslucido, colori semantici.
 */
import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'

type StatoPraticaType = Enums<'stato_pratica_type'>

interface BadgeStatoProps {
  stato: StatoPraticaType
  className?: string
}

const STATO_CONFIG: Record<StatoPraticaType, { label: string; colorClass: string }> = {
  attiva:    { label: 'Attiva',    colorClass: 'bg-success/10 text-success border-success/20'                   },
  sospesa:   { label: 'Sospesa',   colorClass: 'bg-warning/10 text-warning border-warning/20'                   },
  annullata: { label: 'Annullata', colorClass: 'bg-muted text-muted-foreground border-border'                   },
}

export function BadgeStato({ stato, className }: BadgeStatoProps) {
  const { label, colorClass } = STATO_CONFIG[stato]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  )
}
