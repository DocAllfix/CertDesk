/**
 * BadgeFase — badge per fase_type PostgreSQL.
 * Visual: bg-phase-N/10 text-phase-N border-phase-N/20  (traslucido, stile Evalisdesk)
 * Ref: ../evalisdesk-ref/src/components/shared/PhaseBadge.jsx
 */
import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'

type FaseType = Enums<'fase_type'>

interface BadgeFaseProps {
  fase: FaseType
  /** true = label corta ("Contratto"), false = label completa (default) */
  short?: boolean
  className?: string
}

const FASE_CONFIG: Record<FaseType, { label: string; short: string; colorClass: string }> = {
  contratto_firmato:       { label: 'Contratto Firmato',       short: 'Contratto',    colorClass: 'bg-phase-1/10 text-phase-1 border-phase-1/20' },
  programmazione_verifica: { label: 'Programmazione Verifica', short: 'Verifica',     colorClass: 'bg-phase-2/10 text-phase-2 border-phase-2/20' },
  richiesta_proforma:      { label: 'Richiesta Proforma',      short: 'Proforma',     colorClass: 'bg-phase-3/10 text-phase-3 border-phase-3/20' },
  elaborazione_pratica:    { label: 'Elaborazione Pratica',    short: 'Elaborazione', colorClass: 'bg-phase-4/10 text-phase-4 border-phase-4/20' },
  firme:                   { label: 'Firme',                   short: 'Firme',        colorClass: 'bg-phase-5/10 text-phase-5 border-phase-5/20' },
  completata:              { label: 'Completata',              short: 'Completata',   colorClass: 'bg-muted text-muted-foreground border-border'   },
}

export function BadgeFase({ fase, short = false, className }: BadgeFaseProps) {
  const { label, short: shortLabel, colorClass } = FASE_CONFIG[fase]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
        colorClass,
        className,
      )}
    >
      {short ? shortLabel : label}
    </span>
  )
}
