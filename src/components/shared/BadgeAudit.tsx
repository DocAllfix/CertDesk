/**
 * BadgeAudit — badge per audit integrato.
 * Visual: bg-secondary/10 text-secondary border-secondary/20 (colore viola/secondary)
 * Stile coerente con BadgeFase, BadgeCiclo ecc.
 */
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface BadgeAuditProps {
  numeroAudit: string
  auditId?: string
  className?: string
}

export function BadgeAudit({ numeroAudit, auditId, className }: BadgeAuditProps) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
        'bg-secondary/10 text-secondary border border-secondary/20',
        auditId && 'hover:bg-secondary/20 transition-colors cursor-pointer',
        className,
      )}
      title={`Audit Integrato ${numeroAudit}`}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {numeroAudit}
    </span>
  )

  if (auditId) {
    return (
      <Link to={`/audit-integrati/${auditId}`} onClick={(e) => e.stopPropagation()}>
        {content}
      </Link>
    )
  }

  return content
}
