import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'

type FaseType = Enums<'fase_type'>

interface BadgeFaseProps {
  fase: FaseType
  className?: string
}

const FASE_CONFIG: Record<FaseType, { label: string; className: string }> = {
  contratto_firmato: {
    label: 'Contratto Firmato',
    className: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  },
  programmazione_verifica: {
    label: 'Programmazione Verifica',
    className: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  },
  richiesta_proforma: {
    label: 'Richiesta Proforma',
    className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
  elaborazione_pratica: {
    label: 'Elaborazione Pratica',
    className: 'bg-red-500/15 text-red-400 border border-red-500/30',
  },
  firme: {
    label: 'Firme',
    className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  completata: {
    label: 'Completata',
    className: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  },
}

export function BadgeFase({ fase, className }: BadgeFaseProps) {
  const config = FASE_CONFIG[fase]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
