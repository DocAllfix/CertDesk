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
  certificazione:       { label: 'Certificazione',   colorClass: 'bg-primary/10 text-primary border-primary/20'     },
  prima_sorveglianza:   { label: '1ª Sorveglianza',  colorClass: 'bg-warning/10 text-warning border-warning/20'     },
  seconda_sorveglianza: { label: '2ª Sorveglianza',  colorClass: 'bg-phase-5/10 text-phase-5 border-phase-5/20'     },
  ricertificazione:     { label: 'Ricertificazione', colorClass: 'bg-secondary/10 text-secondary border-secondary/20' },
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
