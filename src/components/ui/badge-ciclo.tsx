import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'

type CicloType = Enums<'ciclo_type'>

interface BadgeCicloProps {
  ciclo: CicloType
  className?: string
}

const CICLO_CONFIG: Record<CicloType, { label: string; className: string }> = {
  certificazione: {
    label: 'Certificazione',
    className: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  },
  prima_sorveglianza: {
    label: '1ª Sorveglianza',
    className: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  },
  seconda_sorveglianza: {
    label: '2ª Sorveglianza',
    className: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
  },
  ricertificazione: {
    label: 'Ricertificazione',
    className: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  },
}

export function BadgeCiclo({ ciclo, className }: BadgeCicloProps) {
  const config = CICLO_CONFIG[ciclo]

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
