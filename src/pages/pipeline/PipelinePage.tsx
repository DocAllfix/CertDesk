/**
 * PipelinePage — Vista Kanban con @hello-pangea/dnd.
 *
 * DnD identico a evalisdesk-ref/src/pages/Pipeline.jsx:
 * - DragDropContext + StrictModeDroppable + Draggable
 * - Optimistic update locale (card si sposta subito, rollback se server fallisce)
 * - Nessun bottone "Avanza" — il drag È l'azione
 * - Toast sonner per errori
 */
import { useState, useMemo } from 'react'
import { Search, Filter, Loader2 } from 'lucide-react'
import { Input }  from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DragDropContext, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { StrictModeDroppable } from '@/components/pipeline/StrictModeDroppable'
import { toast } from 'sonner'

import { KanbanCard }      from '@/components/pipeline/KanbanCard'
import { PIPELINE_FASI }   from '@/components/pipeline/KanbanColumn'
import { usePratiche, useAvanzaFase } from '@/hooks/usePratiche'
import { useTeamMembers }  from '@/hooks/useTeamMembers'
import { useAuth }         from '@/hooks/useAuth'
import { canAdvanceFase }  from '@/lib/workflow'

import type { PraticaListItem, FiltriPratiche, FaseType, AuditIntegratoRef } from '@/types/app.types'
import type { Tables } from '@/lib/supabase'

// ── Tipo raw Supabase ────────────────────────────────────────────

type Cliente     = Tables<'clienti'>
type Consulente  = Tables<'consulenti'>
type UserProfile = Tables<'user_profiles'>

type PraticaListRaw = Tables<'pratiche'> & {
  cliente:        Pick<Cliente, 'id' | 'nome' | 'ragione_sociale'>
  consulente:     Pick<Consulente, 'id' | 'nome' | 'cognome'> | null
  assegnato:      Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url'> | null
  pratiche_norme: { norma_codice: string }[]
  audit:          AuditIntegratoRef | null
}

function toListItem(raw: PraticaListRaw): PraticaListItem {
  return {
    ...raw,
    norme: raw.pratiche_norme.map(pn => ({
      codice: pn.norma_codice,
      nome:   pn.norma_codice,
    })),
    audit: raw.audit ?? null,
  }
}

// ── Norme per filtro ─────────────────────────────────────────────

const NORME_LIST = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'SA 8000', 'PAS 24000',
  'PDR 125/2022', 'ESG-EASI', 'ISO 37001', 'ISO 39001', 'ISO 50001',
  'ISO 27001', 'ISO 14064-1', 'ISO 30415', 'ISO 13009', 'ISO 20121',
  'EN 1090', 'ISO 3834',
]

// ── Componente principale ────────────────────────────────────────

export default function PipelinePage() {
  const { isAdmin, userProfile, user } = useAuth()
  const { data: team = [] } = useTeamMembers()
  const avanzaFase = useAvanzaFase()

  const isResponsabile = userProfile?.ruolo === 'responsabile'
  const puoFiltareAssegnato = isAdmin || isResponsabile

  // Filtri locali
  const [normFilter,     setNormFilter]     = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [searchQuery,    setSearchQuery]    = useState('')

  const filtriQuery: FiltriPratiche = useMemo(() => ({
    solo_attive: true,
    ...(normFilter !== 'all'     ? { norma_codice: normFilter }     : {}),
    ...(assigneeFilter !== 'all' ? { assegnato_a:  assigneeFilter } : {}),
  }), [normFilter, assigneeFilter])

  const { data: rawData = [], isLoading, error } = usePratiche(filtriQuery)

  // ── Optimistic update: override fase locale ────────────────────
  // La card si sposta subito. Quando il server risponde e la query
  // si aggiorna, nel calcolo di praticheMap l'override viene
  // ignorato perché combacia con la fase lato server (self-cleaning).
  const [faseOverrides, setFaseOverrides] = useState<Record<string, FaseType>>({})

  // Trasforma + filtro client-side
  const praticheRaw = rawData as unknown as PraticaListRaw[]
  const pratiche: PraticaListItem[] = useMemo(() => {
    const all = praticheRaw
      .filter(p => p.fase !== 'completata')
      .map(toListItem)

    if (!searchQuery.trim()) return all

    const q = searchQuery.trim().toLowerCase()
    return all.filter(p => {
      const clienteNome = (p.cliente?.nome ?? '').toLowerCase()
      const clienteRs   = (p.cliente?.ragione_sociale ?? '').toLowerCase()
      const numPratica  = (p.numero_pratica ?? '').toLowerCase()
      return clienteNome.includes(q) || clienteRs.includes(q) || numPratica.includes(q)
    })
  }, [praticheRaw, searchQuery])

  // Raggruppa per fase con override optimistic
  const praticheMap = useMemo(() => {
    const map: Record<string, PraticaListItem[]> = {}
    for (const config of PIPELINE_FASI) {
      map[config.fase] = []
    }
    for (const p of pratiche) {
      // Override valido solo finché differisce dalla fase del server:
      // quando la mutation conferma l'avanzamento, p.fase diventa la
      // fase target e l'override viene ignorato senza side-effect.
      const override = faseOverrides[p.id]
      const effectiveFase = override && override !== p.fase ? override : p.fase
      if (map[effectiveFase]) {
        map[effectiveFase].push(p)
      }
    }
    return map
  }, [pratiche, faseOverrides])

  // ── DnD — @hello-pangea/dnd ────────────────────────────────────

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination || !user) return

    const targetFase = destination.droppableId as FaseType
    if (targetFase === source.droppableId) return

    const pratica = pratiche.find(p => p.id === draggableId)
    if (!pratica) return

    // Pre-validazione UX
    const validation = canAdvanceFase(pratica, targetFase)
    if (!validation.canAdvance) {
      toast.error('Impossibile spostare', {
        description: validation.missingPrereqs.join(', '),
      })
      return
    }

    // Optimistic: sposta la card immediatamente
    setFaseOverrides(prev => ({ ...prev, [draggableId]: targetFase }))

    // Mutation server
    avanzaFase.mutate(
      {
        id: draggableId,
        oldFase: pratica.fase,
        nuovaFase: targetFase,
        userId: user.id,
        allUsers: team.map(t => ({ id: t.id, ruolo: t.ruolo, nome: t.nome, cognome: t.cognome })),
        audit: pratica.audit ?? undefined,
      },
      {
        onError: (err) => {
          // Rollback: rimuovi l'override → la card torna alla fase originale
          setFaseOverrides(prev => {
            const next = { ...prev }
            delete next[draggableId]
            return next
          })
          toast.error('Errore avanzamento fase', {
            description: (err as Error).message,
          })
        },
        onSuccess: () => {
          // Pulisci override confermato (igiene — praticheMap lo ignora comunque)
          setFaseOverrides(prev => {
            const next = { ...prev }
            delete next[draggableId]
            return next
          })
          const clienteNome = pratica.cliente?.nome ?? pratica.cliente?.ragione_sociale ?? ''
          toast.success(`${clienteNome} spostata a ${targetFase.replaceAll('_', ' ')}`)
        },
      },
    )
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold font-poppins text-foreground">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Vista Kanban — trascina le card per avanzare o retrocedere fase
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cerca cliente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 bg-muted/40 border-border/60 text-sm w-48"
          />
        </div>

        <Select value={normFilter} onValueChange={setNormFilter}>
          <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5 cursor-pointer">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <SelectValue placeholder="Norma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le norme</SelectItem>
            {NORME_LIST.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>

        {puoFiltareAssegnato && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5 cursor-pointer">
              <SelectValue placeholder="Persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {team.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {[t.nome, t.cognome].filter(Boolean).join(' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {pratiche.length} pratiche attive
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Errore */}
      {error && !isLoading && (
        <div className="py-12 text-center">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        </div>
      )}

      {/* Kanban Board */}
      {!isLoading && !error && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
            {PIPELINE_FASI.map(config => {
              const cards = praticheMap[config.fase] ?? []
              return (
                <div key={config.fase} className="min-w-[260px] w-[260px] shrink-0 flex flex-col">
                  {/* Column Header */}
                  <div className={`rounded-t-xl px-4 py-2.5 flex items-center gap-2 ${config.bgColor}`}>
                    <h3 className="text-sm font-semibold text-white flex-1 truncate">
                      {config.label}
                    </h3>
                    <span className="text-xs font-bold text-white/80 bg-black/20 px-2 py-0.5 rounded-full">
                      {cards.length}
                    </span>
                  </div>

                  {/* StrictModeDroppable Column Body */}
                  <StrictModeDroppable droppableId={config.fase}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-2.5 min-h-[200px] rounded-b-xl p-2.5 border border-t-0 border-border/50 transition-colors ${
                          snapshot.isDraggingOver
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-muted/20 dark:bg-muted/10'
                        }`}
                        style={{ maxHeight: 'calc(100vh - 240px)' }}
                      >
                        {cards.map((p, index) => (
                          <Draggable key={p.id} draggableId={p.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={dragProvided.draggableProps.style}
                                className={dragSnapshot.isDragging ? 'opacity-90 rotate-1 scale-105' : ''}
                              >
                                <KanbanCard pratica={p} phaseColor={config.bgColor} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {cards.length === 0 && !snapshot.isDraggingOver && (
                          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60">
                            Nessuna pratica
                          </div>
                        )}
                      </div>
                    )}
                  </StrictModeDroppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  )
}
