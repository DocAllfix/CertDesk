/**
 * BadgeCiclo — badge per ciclo_type PostgreSQL.
 * Componente CertDesk-specifico (non esiste in Evalisdesk).
 * Visual: pattern traslucido, colori semantici.
 */
import { cn } from '@/lib/utils'
import type { Enums } from '@/types/database.types'

type CicloType = Enums<'ciclo_type'>

interface BadgeCicloProps {
  ciclo: CicloType
  className?: string
}

const CICLO_CONFIG: Record<CicloType, { label: string; colorClass: string }> = {
  certificazione:       { label: 'Certificazione',      colorClass: 'bg-primary/10 text-primary border-primary/20'     },
  prima_sorveglianza:   { label: '1ª Sorveglianza',     colorClass: 'bg-warning/10 text-warning border-warning/20'     },
  seconda_sorveglianza: { label: '2ª Sorveglianza',     colorClass: 'bg-phase-5/10 text-phase-5 border-phase-5/20'     },
  terza_sorveglianza:   { label: '3ª Sorveglianza',     colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  quarta_sorveglianza:  { label: '4ª Sorveglianza',     colorClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  follow_up_review:     { label: 'Follow-up Review',    colorClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'   },
  ricertificazione:     { label: 'Ricertificazione',    colorClass: 'bg-secondary/10 text-secondary border-secondary/20' },
  ricertificazione_30m: { label: 'Ricert. 30 mesi',     colorClass: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
}

export function BadgeCiclo({ ciclo, className }: BadgeCicloProps) {
  const { label, colorClass } = CICLO_CONFIG[ciclo]

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
