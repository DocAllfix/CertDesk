/**
 * KanbanColumn — Colonna Kanban per una singola fase.
 *
 * Convertito da: evalisdesk-ref/src/pages/Pipeline.jsx (L62-81)
 *
 * Pattern Evalisdesk:
 * - Header: rounded-t-xl, bg-phase-N solid, nome bianco, contatore bg-black/20
 * - Body: flex-1, bg-muted/20, rounded-b-xl, border border-t-0 border-border/50
 * - Empty state: centered text xs muted
 * - min-w-[260px] w-[260px] shrink-0
 */
import { KanbanCard } from './KanbanCard'
import type { PraticaListItem, FaseType } from '@/types/app.types'

// ── Config fasi (solo le 5 attive, no completata) ────────────────

interface FaseColumnConfig {
  fase: FaseType
  label: string
  bgColor: string
}

export const PIPELINE_FASI: FaseColumnConfig[] = [
  { fase: 'contratto_firmato',       label: 'Contratto Firmato',  bgColor: 'bg-phase-1' },
  { fase: 'programmazione_verifica', label: 'Verifica',           bgColor: 'bg-phase-2' },
  { fase: 'richiesta_proforma',      label: 'Proforma',           bgColor: 'bg-phase-3' },
  { fase: 'elaborazione_pratica',    label: 'Elaborazione',       bgColor: 'bg-phase-4' },
  { fase: 'firme',                   label: 'Firme',              bgColor: 'bg-phase-5' },
]

// ── Props ─────────────────────────────────────────────────────────

interface KanbanColumnProps {
  config: FaseColumnConfig
  pratiche: PraticaListItem[]
  onAvanza?: (pratica: PraticaListItem) => void
}

// ── Componente ────────────────────────────────────────────────────

export function KanbanColumn({ config, pratiche, onAvanza }: KanbanColumnProps) {
  return (
    <div className="min-w-[260px] w-[260px] shrink-0 flex flex-col">

      {/* Column Header — solid colored bar like monday / Evalisdesk */}
      <div className={`rounded-t-xl px-4 py-2.5 flex items-center gap-2 ${config.bgColor}`}>
        <h3 className="text-sm font-semibold text-white flex-1 truncate">
          {config.label}
        </h3>
        <span className="text-xs font-bold text-white/80 bg-black/20 px-2 py-0.5 rounded-full">
          {pratiche.length}
        </span>
      </div>

      {/* Column Body — scrollable cards */}
      <div className="flex-1 space-y-2.5 min-h-[200px] bg-muted/20 dark:bg-muted/10 rounded-b-xl p-2.5 border border-t-0 border-border/50 overflow-y-auto max-h-[calc(100vh-220px)]">
        {pratiche.map(p => (
          <KanbanCard
            key={p.id}
            pratica={p}
            phaseColor={config.bgColor}
            onAvanza={onAvanza}
          />
        ))}
        {pratiche.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60">
            Nessuna pratica
          </div>
        )}
      </div>
    </div>
  )
}
