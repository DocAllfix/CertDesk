/**
 * AuditIntegratiPage — lista audit integrati con filtri e azioni.
 *
 * Mostra: numero audit, cliente, norme (pratiche), stato completamento,
 * prima scadenza, azioni (apri dettaglio).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Search, Loader2, Plus, ExternalLink, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { BadgeUrgenza } from '@/components/shared/BadgeUrgenza'

import { useAuditIntegrati } from '@/hooks/useAuditIntegrati'
import { AuditIntegratoWizard } from '@/components/audit/AuditIntegratoWizard'
import type { AuditIntegratoView } from '@/types/app.types'

// ── Componente riga ──────────────────────────────────────────────

function AuditRow({ audit }: { audit: AuditIntegratoView }) {
  const navigate = useNavigate()

  return (
    <tr
      className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={() => navigate(`/audit-integrati/${audit.id}`)}
    >
      {/* Numero audit */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-secondary" />
          <span className="text-sm font-semibold text-secondary font-mono">
            {audit.numero_audit ?? '—'}
          </span>
        </div>
      </td>

      {/* Pratiche */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">
            {audit.pratiche_completate}/{audit.pratiche_totali}
          </span>
          {audit.is_completato && (
            <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" />
              Completato
            </span>
          )}
        </div>
      </td>

      {/* Attive */}
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {audit.pratiche_attive}
        </span>
      </td>

      {/* Prima scadenza */}
      <td className="px-4 py-3">
        {audit.prima_scadenza ? (
          <div className="flex items-center gap-2">
            <BadgeUrgenza dataScadenza={audit.prima_scadenza} />
            <span className="text-xs text-muted-foreground">
              {format(parseISO(audit.prima_scadenza), 'dd/MM/yyyy')}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Creato il */}
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {audit.created_at ? format(parseISO(audit.created_at), 'dd/MM/yyyy') : '—'}
        </span>
      </td>

      {/* Azioni */}
      <td className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); navigate(`/audit-integrati/${audit.id}`) }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </td>
    </tr>
  )
}

// ── Pagina principale ────────────────────────────────────────────

export default function AuditIntegratiPage() {
  const [ricerca, setRicerca]       = useState('')
  const [tab, setTab]               = useState<'attivi' | 'completati'>('attivi')
  const [wizardOpen, setWizardOpen] = useState(false)

  // Carico SEMPRE tutti gli audit (no filtro server) per poter mostrare
  // i conteggi corretti su entrambi i tab. Il filtro tab è client-side.
  const { data: auditRaw = [], isLoading, error } = useAuditIntegrati({
    ricerca: ricerca || null,
  })

  // Conteggio per tab
  const countAttivi     = auditRaw.filter(a => !a.is_completato).length
  const countCompletati = auditRaw.filter(a => a.is_completato).length

  // Filtro tab client-side
  const audit = tab === 'attivi'
    ? auditRaw.filter(a => !a.is_completato)
    : auditRaw.filter(a => a.is_completato)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-poppins text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" />
            Audit Integrati
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestione audit multi-norma raggruppati
          </p>
        </div>
        <Button
          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nuovo Audit
        </Button>
      </div>

      {/* Filtri */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per numero audit..."
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Tab switcher Attivi/Completati — stesso pattern di PratichePage */}
          <div className="ml-auto flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button
              onClick={() => setTab('attivi')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                tab === 'attivi'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Attivi
              {!isLoading && (
                <span className="ml-1.5 text-[10px] opacity-60">({countAttivi})</span>
              )}
            </button>
            <button
              onClick={() => setTab('completati')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                tab === 'completati'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Completati
              {!isLoading && (
                <span className="ml-1.5 text-[10px] opacity-60">({countCompletati})</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 text-muted-foreground animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="py-12 text-center">
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Audit</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Pratiche</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Attive</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Prima scadenza</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Creato il</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <AuditRow key={a.id} audit={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && audit.length === 0 && (
          <div className="py-16 text-center">
            <Sparkles className="w-8 h-8 text-secondary/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nessun audit integrato trovato</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Crea un nuovo audit integrato selezionando 2+ norme
            </p>
          </div>
        )}
      </div>

      {/* Wizard */}
      <AuditIntegratoWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </div>
  )
}
