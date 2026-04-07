/**
 * PromemoriaPage — pagina globale promemoria dell'utente corrente.
 *
 * Mostra tutti i promemoria non completati (assegnato_a o creato_da = utente corrente)
 * ordinati per data_scadenza crescente.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/PromemoriaSection.jsx
 *             (adattato a layout full-page con link pratica)
 *
 * NOTA: i promemoria di sorveglianza (badge "Auto") sono generati automaticamente
 * dal trigger PostgreSQL on_pratica_completata — nessun codice client necessario.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, CheckCircle2, Circle, RefreshCw,
  Loader2, ExternalLink, Trash2, ClipboardList,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'

import {
  usePromemoriaUtente,
  useTogglePromemoria,
  useDeletePromemoria,
} from '@/hooks/usePromemoria'
import { BadgeFase } from '@/components/shared/BadgeFase'
import type { PromemoriaConRelazioni } from '@/types/app.types'

// ── Helpers ───────────────────────────────────────────────────────

function isAutoPromemoria(p: PromemoriaConRelazioni): boolean {
  return p.testo.startsWith('Sorveglianza ')
}

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM yyyy', { locale: it }) }
  catch { return d }
}

/** Ritorna stringa con i giorni rimanenti e classe colore per urgenza */
function getScadenzaInfo(d: string | null | undefined): {
  label: string
  colorClass: string
} {
  if (!d) return { label: '—', colorClass: 'text-muted-foreground' }
  const days = differenceInDays(parseISO(d), new Date())
  if (days < 0)   return { label: `Scaduto`,          colorClass: 'text-destructive font-semibold' }
  if (days === 0) return { label: `Scade oggi`,        colorClass: 'text-destructive font-semibold' }
  if (days <= 7)  return { label: `${days}g`,          colorClass: 'text-destructive font-medium'  }
  if (days <= 30) return { label: `${days}g`,          colorClass: 'text-warning font-medium'      }
  return             { label: `${days}g`,              colorClass: 'text-muted-foreground'          }
}

// ── Componente ────────────────────────────────────────────────────

export default function PromemoriaPage() {
  const { data: items = [], isLoading, error } = usePromemoriaUtente()
  const toggleMut = useTogglePromemoria()
  const deleteMut = useDeletePromemoria()

  const [hoveredId, setHoveredId] = useState<string | null>(null)

  function handleToggle(id: string, currentVal: boolean | null) {
    toggleMut.mutate({ id, completato: !currentVal })
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deleteMut.mutate({ id })
  }

  // ── Loading ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-destructive font-medium">
          {(error as Error).message}
        </p>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Promemoria</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            I tuoi promemoria attivi
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-12 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nessun promemoria attivo</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            I promemoria attivi appariranno qui. Puoi aggiungerli dal dettaglio di una pratica.
          </p>
        </div>
      </div>
    )
  }

  // ── Lista ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Promemoria</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} {items.length === 1 ? 'promemoria attivo' : 'promemoria attivi'}
          </p>
        </div>
      </div>

      {/* Tabella — Evalisdesk table pattern */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 w-8"></th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Promemoria</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Pratica</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Scadenza</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const scadenza = getScadenzaInfo(item.data_scadenza)
                const isAuto   = isAutoPromemoria(item)
                return (
                  <tr
                    key={item.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Toggle completato */}
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggle(item.id, item.completato)}
                        disabled={toggleMut.isPending}
                        className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-muted transition-colors"
                      >
                        {toggleMut.isPending && toggleMut.variables?.id === item.id
                          ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          : item.completato
                            ? <CheckCircle2 className="w-4 h-4 text-success" />
                            : <Circle       className="w-4 h-4 text-muted-foreground" />
                        }
                      </button>
                    </td>

                    {/* Testo + badge Auto */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-2">
                        <p className="text-sm text-foreground leading-snug">{item.testo}</p>
                        {isAuto && (
                          <span className="flex items-center gap-0.5 bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full text-[10px] shrink-0 mt-0.5">
                            <RefreshCw className="w-2.5 h-2.5" /> Auto
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Pratica collegata */}
                    <td className="px-5 py-3.5">
                      {item.pratica ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            {item.pratica.numero_pratica}
                          </span>
                          <BadgeFase fase={item.pratica.fase} short />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Scadenza */}
                    <td className="px-5 py-3.5">
                      {item.data_scadenza ? (
                        <div className="flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className={`text-sm ${scadenza.colorClass}`}>
                            {fmtData(item.data_scadenza)}
                          </span>
                          <span className={`text-xs ${scadenza.colorClass}`}>
                            ({scadenza.label})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Azioni */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Link alla pratica */}
                        {item.pratica && (
                          <Link
                            to={`/pratiche/${item.pratica.id}`}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Apri pratica"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}
                        {/* Delete (solo promemoria manuali) */}
                        {!isAuto && hoveredId === item.id && (
                          <button
                            onClick={(e) => handleDelete(item.id, e)}
                            disabled={deleteMut.isPending}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Elimina promemoria"
                          >
                            {deleteMut.isPending && deleteMut.variables?.id === item.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
