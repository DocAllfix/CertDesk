/**
 * KanbanCard — Card pratica nella pipeline Kanban.
 *
 * Design ref: evalisdesk-ref/src/components/pipeline/PipelineCard.jsx
 *
 * IMPORTANTE: usa <div onClick> e NON <Link> per evitare conflitto
 * con @hello-pangea/dnd (il browser drag nativo dei link compete col DnD).
 */
import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Calendar } from 'lucide-react'

import { BadgeUrgenza }  from '@/components/shared/BadgeUrgenza'
import { BadgeAudit }    from '@/components/shared/BadgeAudit'
import { isBloccataFase4 } from '@/lib/workflow'
import type { PraticaListItem } from '@/types/app.types'

// ── Props ─────────────────────────────────────────────────────────

interface KanbanCardProps {
  pratica: PraticaListItem
  phaseColor: string
}

// ── Helpers ───────────────────────────────────────────────────────

function iniziali(p: PraticaListItem): string {
  const a = p.assegnato
  if (!a) return '?'
  return ((a.nome?.[0] ?? '') + (a.cognome?.[0] ?? '')).toUpperCase() || '?'
}

function nomeCliente(p: PraticaListItem): string {
  return p.cliente?.nome ?? p.cliente?.ragione_sociale ?? '—'
}

const CICLO_SHORT: Record<string, string> = {
  certificazione:       'Cert.',
  prima_sorveglianza:   '1ª Sorv.',
  seconda_sorveglianza: '2ª Sorv.',
  ricertificazione:     'Ricert.',
}

// ── Mini checklist (4 puntini colorati) ──────────────────────────

function MiniChecklist({ pratica }: { pratica: PraticaListItem }) {
  const dots: { title: string; ok: boolean }[] = [
    { title: 'Data verifica',    ok: !!pratica.data_verifica },
    { title: 'Proforma emessa',  ok: !!pratica.proforma_emessa },
    { title: 'Documenti',        ok: !!pratica.documenti_ricevuti },
    { title: 'Completata',       ok: pratica.fase === 'completata' },
  ]
  return (
    <div className="flex items-center gap-1">
      {dots.map(d => (
        <div
          key={d.title}
          title={d.title}
          className={`w-2 h-2 rounded-full ${d.ok ? 'bg-success' : 'bg-muted-foreground/20'}`}
        />
      ))}
    </div>
  )
}

// ── Componente ────────────────────────────────────────────────────

export const KanbanCard = memo(function KanbanCard({ pratica, phaseColor }: KanbanCardProps) {
  const navigate = useNavigate()
  const bloccata = isBloccataFase4(pratica)

  const handleClick = (e: React.MouseEvent) => {
    // Non navigare se si stava trascinando (il browser potrebbe fireare click dopo drop)
    if ((e.target as HTMLElement).closest('button')) return
    navigate(`/pratiche/${pratica.id}`)
  }

  return (
    <div
      onClick={handleClick}
      className={`block bg-card rounded-lg border hover:shadow-md hover:border-border/80 transition-all duration-150 group overflow-hidden cursor-pointer
        ${bloccata ? 'border-destructive/50 ring-1 ring-destructive/20' : 'border-border'}`}
    >
      {/* Left colored accent bar */}
      <div className="flex">
        <div className={`w-1 shrink-0 ${phaseColor}`} />
        <div className="flex-1 p-3">

          {/* Client name */}
          <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors truncate mb-0.5">
            {nomeCliente(pratica)}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono mb-2">
            {pratica.numero_pratica ?? '—'}
          </p>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            {pratica.norme.slice(0, 3).map(n => (
              <span key={n.codice} className="text-[11px] bg-muted/80 px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                {n.codice}
              </span>
            ))}
            {pratica.norme.length > 3 && (
              <span className="text-[10px] text-muted-foreground/60">+{pratica.norme.length - 3}</span>
            )}
            <span className="text-[11px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">
              {CICLO_SHORT[pratica.ciclo] ?? pratica.ciclo}
            </span>
            {pratica.audit && (
              <BadgeAudit numeroAudit={pratica.audit.numero_audit} auditId={pratica.audit.id} />
            )}
          </div>

          {/* Deadline + urgency */}
          {pratica.data_scadenza && (
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <BadgeUrgenza dataScadenza={pratica.data_scadenza} className="text-[10px] px-1.5 py-0.5" />
            </div>
          )}

          {/* Missing docs warning */}
          {bloccata && (
            <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
              <span className="text-[11px] font-medium text-destructive">Doc. mancanti</span>
            </div>
          )}

          {/* Footer — avatar + mini checklist */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary-foreground">{iniziali(pratica)}</span>
            </div>
            <MiniChecklist pratica={pratica} />
          </div>
        </div>
      </div>
    </div>
  )
})
