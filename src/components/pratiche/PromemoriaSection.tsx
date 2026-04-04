/**
 * PromemoriaSection — sezione promemoria nel dettaglio pratica.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/PromemoriaSection.jsx
 *
 * Pattern Evalisdesk mantenuti:
 * - Card bg-card rounded-xl border border-border overflow-hidden
 * - Header px-5 py-4 border-b con bottone Aggiungi ghost h-7 text-xs
 * - Item: button con CheckCircle2/Circle, testo, data con Bell icon
 * - Badge "Auto" (bg-secondary/10 text-secondary) per sorveglianza trigger
 * - Form inline: Input testo + Input date + bottoni Aggiungi/Annulla
 *
 * Aggiunte CertDesk:
 * - Dati reali da usePromemoriaPerPratica
 * - Tab filtro Attivi / Completati
 * - Badge Auto rileva testo che inizia con "Sorveglianza " (convenzione trigger)
 * - Icona delete (Trash2) su hover per promemoria manuali
 * - Contatore badge nel titolo per attivi
 */
import { useState } from 'react'
import { Bell, CheckCircle2, Circle, Plus, RefreshCw, Loader2, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import {
  usePromemoriaPerPratica,
  useCreatePromemoria,
  useTogglePromemoria,
  useDeletePromemoria,
} from '@/hooks/usePromemoria'
import type { PromemoriaConRelazioni } from '@/types/app.types'

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Rileva promemoria auto-generati dal trigger on_pratica_completata.
 * Il trigger scrive testi come "Sorveglianza ISO 9001 per pratica CERT-..."
 */
function isAutoPromemoria(p: PromemoriaConRelazioni): boolean {
  return p.testo.startsWith('Sorveglianza ')
}

function fmtData(d: string | null | undefined): string {
  if (!d) return ''
  try { return format(parseISO(d), 'd MMM yyyy', { locale: it }) }
  catch { return d }
}

// ── Props ─────────────────────────────────────────────────────────

interface PromemoriaSectionProps {
  praticaId: string
}

type Filtro = 'attivi' | 'completati'

// ── Componente ────────────────────────────────────────────────────

export function PromemoriaSection({ praticaId }: PromemoriaSectionProps) {
  const { user } = useAuth()
  const { data: items = [], isLoading } = usePromemoriaPerPratica(praticaId)
  const createMut = useCreatePromemoria()
  const toggleMut = useTogglePromemoria()
  const deleteMut = useDeletePromemoria()

  const [filtro,    setFiltro]    = useState<Filtro>('attivi')
  const [adding,    setAdding]    = useState(false)
  const [newTesto,  setNewTesto]  = useState('')
  const [newDate,   setNewDate]   = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const attivi     = items.filter(i => !i.completato)
  const completati = items.filter(i =>  i.completato)
  const displayed  = filtro === 'attivi' ? attivi : completati

  function handleAdd() {
    if (!user || !newTesto.trim()) return
    createMut.mutate(
      {
        pratica_id:    praticaId,
        creato_da:     user.id,
        assegnato_a:   user.id,
        testo:         newTesto.trim(),
        data_scadenza: newDate || null,
      },
      {
        onSuccess: () => {
          setNewTesto('')
          setNewDate('')
          setAdding(false)
        },
      }
    )
  }

  function handleToggle(id: string, currentVal: boolean | null) {
    toggleMut.mutate({ id, completato: !currentVal })
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation() // non triggerare il toggle del parent
    deleteMut.mutate({ id })
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header — Evalisdesk pattern */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Promemoria</h3>
          {attivi.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {attivi.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Tab filtro attivi/completati */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              onClick={() => setFiltro('attivi')}
              className={`px-2.5 py-1 font-medium transition-colors ${
                filtro === 'attivi'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              Attivi
            </button>
            <button
              onClick={() => setFiltro('completati')}
              className={`px-2.5 py-1 font-medium transition-colors border-l border-border ${
                filtro === 'completati'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              Fatti
            </button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => setAdding(v => !v)}
          >
            <Plus className="w-3.5 h-3.5" /> Aggiungi
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && displayed.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            {filtro === 'attivi'
              ? 'Nessun promemoria attivo'
              : 'Nessun promemoria completato'}
          </p>
        )}

        {/* Lista — Evalisdesk pattern */}
        {displayed.map(item => (
          <button
            key={item.id}
            onClick={() => handleToggle(item.id, item.completato)}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            disabled={toggleMut.isPending || deleteMut.isPending}
            className={`w-full flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all ${
              item.completato
                ? 'bg-success/5 border-success/20 opacity-60'
                : 'bg-muted/20 border-border hover:border-primary/30'
            }`}
          >
            {item.completato
              ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
              : <Circle      className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            }

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${
                item.completato ? 'line-through text-muted-foreground' : 'text-foreground'
              }`}>
                {item.testo}
              </p>
              {item.data_scadenza && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                  <Bell className="w-3 h-3 shrink-0" />
                  {fmtData(item.data_scadenza)}
                  {isAutoPromemoria(item) && (
                    <span className="flex items-center gap-0.5 bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full text-[10px]">
                      <RefreshCw className="w-2.5 h-2.5" /> Auto
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Delete on hover — solo promemoria manuali */}
            {hoveredId === item.id && !isAutoPromemoria(item) && (
              <span
                role="button"
                className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                onClick={(e) => handleDelete(item.id, e)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        ))}

        {/* Form aggiunta rapida — Evalisdesk pattern */}
        {adding && (
          <div className="space-y-2 pt-2 border-t border-border">
            <Input
              placeholder="Testo promemoria..."
              value={newTesto}
              onChange={e => setNewTesto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="h-8 text-sm"
              autoFocus
            />
            <Input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-primary hover:bg-primary/90"
                disabled={!newTesto.trim() || createMut.isPending}
                onClick={handleAdd}
              >
                {createMut.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : 'Aggiungi'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setAdding(false); setNewTesto(''); setNewDate('') }}
              >
                Annulla
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
