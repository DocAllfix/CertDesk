/**
 * PraticaRow — riga per la tabella pratiche.
 *
 * Colonne: Cliente/Numero | Norme | Ciclo | Fase | Stato | Contatto | Scadenza | Checklist | Azioni
 * Bordo sinistro rosso se scadenza < 15 giorni (pattern Evalisdesk).
 * Azioni: Modifica (modal), Apri dettaglio, Sospendi/Annulla (solo admin).
 *
 * Design ref: ../evalisdesk-ref/src/pages/Pratiche.jsx (tabella rows)
 */
import { memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink, Pencil, ChevronRight, PauseCircle, XCircle, MoreHorizontal, Sparkles, Check, Archive, Trash2 } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

import { BadgeFase } from '@/components/shared/BadgeFase'
import { BadgeCiclo } from '@/components/shared/BadgeCiclo'
import { BadgeStato } from '@/components/shared/BadgeStato'
import { BadgeUrgenza } from '@/components/shared/BadgeUrgenza'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

import type { PraticaListItem } from '@/types/app.types'

// ── Props ─────────────────────────────────────────────────────────

interface PraticaRowProps {
  pratica:    PraticaListItem
  isAdmin:    boolean
  isResponsabile?: boolean
  onModifica: (pratica: PraticaListItem) => void
  onAvanza?:  (pratica: PraticaListItem) => void
  onSospendi?: (pratica: PraticaListItem) => void
  onAnnulla?:  (pratica: PraticaListItem) => void
  onArchivia?: (pratica: PraticaListItem) => void
  onElimina?:  (pratica: PraticaListItem) => void
  onPrefetch?: (id: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────

function isUrgente(dataScadenza: string | null): boolean {
  if (!dataScadenza) return false
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  return differenceInDays(parseISO(dataScadenza), oggi) <= 15
}

function nomeCliente(p: PraticaListItem): string {
  return p.cliente?.nome ?? p.cliente?.ragione_sociale ?? '—'
}

function nomeContatto(p: PraticaListItem): string {
  if (p.tipo_contatto === 'consulente') {
    if (!p.consulente) return 'Consulente'
    return [p.consulente.nome, p.consulente.cognome].filter(Boolean).join(' ') || 'Consulente'
  }
  return p.referente_nome ?? 'Referente diretto'
}

function iniziali(p: PraticaListItem): string {
  const a = p.assegnato
  if (!a) return '?'
  return ((a.nome?.[0] ?? '') + (a.cognome?.[0] ?? '')).toUpperCase() || '?'
}

// ── Checklist compatta (flag DB) ──────────────────────────────────

function ChecklistCompatta({ pratica }: { pratica: PraticaListItem }) {
  const flags = [
    { key: 'proforma',   value: pratica.proforma_emessa,    title: 'Proforma emessa' },
    { key: 'documenti',  value: pratica.documenti_ricevuti, title: 'Documenti ricevuti' },
  ]
  return (
    <div className="flex items-center gap-1">
      {flags.map(({ key, value, title }) => (
        <div
          key={key}
          title={title}
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
            value ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {value ? <Check className="w-3 h-3" /> : <span className="text-[10px] font-bold">✕</span>}
        </div>
      ))}
    </div>
  )
}

// ── Componente ────────────────────────────────────────────────────

export const PraticaRow = memo(function PraticaRow({
  pratica,
  isAdmin,
  isResponsabile,
  onModifica,
  onAvanza,
  onSospendi,
  onAnnulla,
  onArchivia,
  onElimina,
  onPrefetch,
}: PraticaRowProps) {
  const urgente = isUrgente(pratica.data_scadenza)
  const navigate = useNavigate()

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Non navigare se click su elementi interattivi (button, link, input, dropdown)
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, [role="menuitem"], [data-radix-collection-item]')) return
    navigate(`/pratiche/${pratica.id}`)
  }

  return (
    <tr
      className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors group cursor-pointer
        border-l-2 ${urgente ? 'border-l-destructive' : 'border-l-transparent'}`}
      onMouseEnter={() => onPrefetch?.(pratica.id)}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          className="w-3.5 h-3.5 rounded border-border accent-primary"
          aria-label="Seleziona pratica"
        />
      </td>

      {/* Cliente / Numero */}
      <td className="px-3 py-2.5 min-w-[200px]">
        <p className="text-[14px] leading-[18px] font-semibold text-foreground">
          {nomeCliente(pratica)}
        </p>
        <p className="text-[12px] text-muted-foreground mt-0.5 font-mono">
          {pratica.numero_pratica ?? '—'}
        </p>
      </td>

      {/* Assegnato */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{iniziali(pratica)}</span>
          </div>
          <span className="text-xs text-muted-foreground hidden xl:inline">
            {pratica.assegnato?.nome?.split(' ')[0] ?? '—'}
          </span>
        </div>
      </td>

      {/* Fase */}
      <td className="px-3 py-2.5 min-w-[130px]">
        <BadgeFase fase={pratica.fase} short />
      </td>

      {/* Stato (solo se non attiva) */}
      <td className="px-3 py-2.5">
        {pratica.stato !== 'attiva'
          ? <BadgeStato stato={pratica.stato} />
          : <span className="text-xs text-muted-foreground/40">—</span>}
      </td>

      {/* Scadenza */}
      <td className="px-3 py-2.5">
        <BadgeUrgenza dataScadenza={pratica.data_scadenza} />
      </td>

      {/* Norme */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          {pratica.norme.map((n) => (
            <span
              key={n.codice}
              className="text-xs bg-muted px-2 py-0.5 rounded font-medium text-muted-foreground"
            >
              {n.codice}
            </span>
          ))}
          {pratica.norme.length > 1 && (
            <span className="text-xs bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </td>

      {/* Ciclo */}
      <td className="px-3 py-2.5">
        <BadgeCiclo ciclo={pratica.ciclo} />
      </td>

      {/* Contatto */}
      <td className="px-3 py-2.5">
        <span className="text-xs text-muted-foreground">{nomeContatto(pratica)}</span>
      </td>

      {/* Checklist */}
      <td className="px-3 py-2.5">
        <ChecklistCompatta pratica={pratica} />
      </td>

      {/* Azioni */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Link dettaglio */}
          <Link
            to={`/pratiche/${pratica.id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Apri dettaglio"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>

          {/* Dropdown altre azioni */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Altre azioni"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => onModifica(pratica)}
                className="gap-2 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modifica
              </DropdownMenuItem>

              {onAvanza && pratica.stato === 'attiva' && pratica.fase !== 'completata' && (
                <DropdownMenuItem
                  onClick={() => onAvanza(pratica)}
                  className="gap-2 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  Avanza Fase
                </DropdownMenuItem>
              )}

              {isAdmin && pratica.stato === 'attiva' && (
                <>
                  <DropdownMenuSeparator />
                  {onSospendi && (
                    <DropdownMenuItem
                      onClick={() => onSospendi(pratica)}
                      className="gap-2 cursor-pointer text-warning focus:text-warning"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      Sospendi
                    </DropdownMenuItem>
                  )}
                  {onAnnulla && (
                    <DropdownMenuItem
                      onClick={() => onAnnulla(pratica)}
                      className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Annulla
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {onArchivia && pratica.fase === 'completata' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onArchivia(pratica)}
                    className="gap-2 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archivia
                  </DropdownMenuItem>
                </>
              )}

              {onElimina && (isAdmin || isResponsabile) && pratica.stato === 'attiva' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onElimina(pratica)}
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Elimina
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
})
