/**
 * AuditIntegratoSection — sezione nel dettaglio pratica che mostra le
 * pratiche sorelle dello stesso audit integrato.
 *
 * Mostra: numero audit, lista pratiche con fase/stato/norma/assegnato,
 * link cliccabile a ciascuna pratica sorella.
 */
import { Link } from 'react-router-dom'
import { Sparkles, ExternalLink } from 'lucide-react'
import { BadgeFase } from '@/components/shared/BadgeFase'
import { useAuditIntegrato } from '@/hooks/useAuditIntegrati'

interface AuditIntegratoSectionProps {
  auditId: string
  currentPraticaId: string
}

export function AuditIntegratoSection({ auditId, currentPraticaId }: AuditIntegratoSectionProps) {
  const { data: audit, isLoading } = useAuditIntegrato(auditId)

  if (isLoading) {
    return (
      <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-secondary/10 rounded w-48" />
      </div>
    )
  }

  if (!audit) return null

  return (
    <div className="bg-secondary/5 border border-secondary/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-secondary/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-secondary" />
          <span className="text-sm font-semibold text-secondary">
            Audit Integrato
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {audit.numero_audit}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {audit.pratiche_completate}/{audit.pratiche_totali} completate
          </span>
          {audit.is_completato && (
            <span className="text-success font-medium">Completato</span>
          )}
        </div>
      </div>

      {/* Lista pratiche sorelle */}
      <div className="divide-y divide-border/30">
        {audit.pratiche.map((p) => {
          const isCurrent = p.id === currentPraticaId
          const normaLabel = p.norme?.[0]?.codice ?? '—'

          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                isCurrent ? 'bg-secondary/10' : 'hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-[120px]">
                  {p.numero_pratica ?? '—'}
                </span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">
                  {normaLabel}
                </span>
                <BadgeFase fase={p.fase} short />
              </div>

              <div className="flex items-center gap-2">
                {p.assegnato && (
                  <span className="text-xs text-muted-foreground">
                    {p.assegnato.nome?.split(' ')[0] ?? '—'}
                  </span>
                )}
                {isCurrent ? (
                  <span className="text-[10px] text-secondary font-medium px-1.5 py-0.5 bg-secondary/10 rounded">
                    corrente
                  </span>
                ) : (
                  <Link
                    to={`/pratiche/${p.id}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Apri pratica"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
