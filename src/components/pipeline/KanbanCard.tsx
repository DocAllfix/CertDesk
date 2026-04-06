/**
 * KanbanCard — Card pratica nella pipeline Kanban.
 *
 * Convertito da: evalisdesk-ref/src/components/pipeline/PipelineCard.jsx
 *
 * Pattern Evalisdesk mantenuti:
 * - Link wrapper (click navigates to /pratiche/:id)
 * - Barra sinistra 4px (w-1) bg-phase-N
 * - Nome cliente bold, truncate, hover text-primary
 * - Norme come tag bg-muted/80 text-[11px]
 * - Ciclo come tag bg-muted/60
 * - Calendar + UrgencyBadge
 * - Missing docs alert: bg-destructive/10 border-destructive/20
 * - Footer: avatar + azioni hover
 *
 * Aggiunte CertDesk:
 * - Bottone "→ Avanza" con pre-validazione canAdvanceFase()
 * - Mini checklist (4 dots)
 * - Numero pratica CERT-2026-NNNN
 */
import { memo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Calendar, ChevronRight } from 'lucide-react'

import { BadgeUrgenza }  from '@/components/shared/BadgeUrgenza'
import { isBloccataFase4, canAdvanceFase, getNextFase } from '@/lib/workflow'
import type { PraticaListItem } from '@/types/app.types'

// ── Props ─────────────────────────────────────────────────────────

interface KanbanCardProps {
  pratica: PraticaListItem
  phaseColor: string
  onAvanza?: (pratica: PraticaListItem) => void
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

// Mapping ciclo_type → label compatta
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

export const KanbanCard = memo(function KanbanCard({ pratica, phaseColor, onAvanza }: KanbanCardProps) {
  const bloccata = isBloccataFase4(pratica)
  const nextFase = getNextFase(pratica.fase)

  // Pre-validazione UX per il bottone "Avanza"
  const preValidazione = nextFase
    ? canAdvanceFase(pratica, nextFase)
    : null

  return (
    <div className="space-y-1.5">
      <Link
        to={`/pratiche/${pratica.id}`}
        className={`block bg-card rounded-lg border hover:shadow-md hover:border-border/80 transition-all duration-150 group overflow-hidden
          ${bloccata ? 'border-destructive/50 ring-1 ring-destructive/20' : 'border-border'}`}
      >
        {/* Left colored accent bar — Evalisdesk pattern */}
        <div className="flex">
          <div className={`w-1 shrink-0 ${phaseColor}`} />
          <div className="flex-1 p-3">

            {/* Client name — bold, truncate, hover primary */}
            <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors truncate mb-0.5">
              {nomeCliente(pratica)}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mb-2">
              {pratica.numero_pratica ?? '—'}
            </p>

            {/* Tags row — Evalisdesk: bg-muted/80, text-[11px] */}
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
            </div>

            {/* Deadline + urgency — Evalisdesk pattern */}
            {pratica.data_scadenza && (
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <BadgeUrgenza dataScadenza={pratica.data_scadenza} className="text-[10px] px-1.5 py-0.5" />
              </div>
            )}

            {/* Missing docs warning — Evalisdesk exact pattern */}
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
      </Link>

      {/* Bottone Avanza — sotto la card, sottile */}
      {nextFase && onAvanza && (
        <button
          type="button"
          disabled={!preValidazione?.canAdvance}
          title={
            preValidazione?.canAdvance
              ? `Avanza a ${nextFase}`
              : preValidazione?.missingPrereqs.join(', ') ?? ''
          }
          onClick={() => onAvanza(pratica)}
          className={`w-full flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer
            ${preValidazione?.canAdvance
              ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
              : 'bg-muted/30 text-muted-foreground/40 border border-border/50 cursor-not-allowed'
            }`}
        >
          <ChevronRight className="w-3 h-3" />
          Avanza
        </button>
      )}
    </div>
  )
})
