/**
 * PipelinePage — Vista Kanban orizzontale con 5 colonne + Drag & Drop.
 *
 * Convertito da: c:\Users\user\Desktop\evalisdesk-ref\src\pages\Pipeline.jsx
 *
 * Features:
 * - DnD con @dnd-kit: trascina card tra colonne per avanzare/retrocedere fase
 * - Ricerca client-side su nome cliente + numero pratica
 * - Filtri per norma e assegnato
 * - Solo pratiche con stato = 'attiva', escluse completate
 * - Scroll verticale nelle colonne
 */
import { useState, useMemo } from 'react'
import { Search, Filter, Loader2, GripVertical } from 'lucide-react'
import { Input }  from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'

import { KanbanCard }      from '@/components/pipeline/KanbanCard'
import { PIPELINE_FASI }   from '@/components/pipeline/KanbanColumn'
import { usePratiche, useAvanzaFase } from '@/hooks/usePratiche'
import { useTeamMembers }  from '@/hooks/useTeamMembers'
import { useAuth }         from '@/hooks/useAuth'
import { canAdvanceFase }  from '@/lib/workflow'

import type { PraticaListItem, FiltriPratiche, FaseType } from '@/types/app.types'
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
}

function toListItem(raw: PraticaListRaw): PraticaListItem {
  return {
    ...raw,
    norme: raw.pratiche_norme.map(pn => ({
      codice: pn.norma_codice,
      nome:   pn.norma_codice,
    })),
  }
}

// ── Norme per filtro ─────────────────────────────────────────────

const NORME_LIST = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'SA 8000', 'PAS 24000',
  'PDR 125/2022', 'ESG-EASI', 'ISO 37001', 'ISO 39001', 'ISO 50001',
  'ISO 27001', 'ISO 14064-1', 'ISO 30415', 'ISO 13009', 'ISO 20121',
  'EN 1090', 'ISO 3834',
]

// ── Droppable Column ─────────────────────────────────────────────

interface DroppableColumnProps {
  config: typeof PIPELINE_FASI[0]
  pratiche: PraticaListItem[]
  onAvanza?: (pratica: PraticaListItem) => void
}

function DroppableColumn({ config, pratiche, onAvanza }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: config.fase })

  return (
    <div className="min-w-[260px] w-[260px] shrink-0 flex flex-col">
      {/* Column Header — Evalisdesk: solid colored bar */}
      <div className={`rounded-t-xl px-4 py-2.5 flex items-center gap-2 ${config.bgColor}`}>
        <h3 className="text-sm font-semibold text-white flex-1 truncate">
          {config.label}
        </h3>
        <span className="text-xs font-bold text-white/80 bg-black/20 px-2 py-0.5 rounded-full">
          {pratiche.length}
        </span>
      </div>

      {/* Column Body — scrollable, droppable */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2.5 min-h-[200px] rounded-b-xl p-2.5 border border-t-0 border-border/50
          overflow-y-auto
          transition-colors duration-150
          ${isOver
            ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/20'
            : 'bg-muted/20 dark:bg-muted/10'
          }`}
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        {pratiche.map(p => (
          <DraggableCard key={p.id} pratica={p} phaseColor={config.bgColor} onAvanza={onAvanza} />
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

// ── Draggable Card ───────────────────────────────────────────────

import { useDraggable } from '@dnd-kit/core'

interface DraggableCardProps {
  pratica: PraticaListItem
  phaseColor: string
  onAvanza?: (pratica: PraticaListItem) => void
}

function DraggableCard({ pratica, phaseColor, onAvanza }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: pratica.id,
    data: { pratica },
  })

  return (
    <div
      ref={setNodeRef}
      className={`relative ${isDragging ? 'opacity-30 scale-[0.98]' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="absolute top-3 right-2 z-10 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted/60 transition-colors"
        title="Trascina per spostare"
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
      </div>
      <KanbanCard pratica={pratica} phaseColor={phaseColor} onAvanza={onAvanza} />
    </div>
  )
}

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

  // Filtri query layer (solo server-side: norma, assegnato)
  const filtriQuery: FiltriPratiche = {
    solo_attive: true,
    ...(normFilter !== 'all'     ? { norma_codice: normFilter }     : {}),
    ...(assigneeFilter !== 'all' ? { assegnato_a:  assigneeFilter } : {}),
  }

  const { data: rawData = [], isLoading, error } = usePratiche(filtriQuery)

  // Trasforma + filtro client-side (ricerca su nome cliente + numero_pratica)
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

  // Raggruppa per fase
  const pratichePerFase = (fase: string) =>
    pratiche.filter(p => p.fase === fase)

  // ── DnD ────────────────────────────────────────────────────────

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activePratica = activeDragId
    ? pratiche.find(p => p.id === activeDragId) ?? null
    : null

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || !user) return

    const praticaId = active.id as string
    const targetFase = over.id as FaseType
    const pratica = pratiche.find(p => p.id === praticaId)
    if (!pratica || pratica.fase === targetFase) return

    // Pre-validazione UX
    const validation = canAdvanceFase(pratica, targetFase)
    if (!validation.canAdvance) {
      // Potremmo mostrare un toast qui in futuro
      return
    }

    // Avanza fase via orchestrator
    avanzaFase.mutate({
      id: praticaId,
      oldFase: pratica.fase,
      nuovaFase: targetFase,
      userId: user.id,
      allUsers: team.map(t => ({ id: t.id, ruolo: t.ruolo, nome: t.nome, cognome: t.cognome })),
    })
  }

  // Handler avanza da bottone (navigazione al dettaglio)
  const handleAvanza = (p: PraticaListItem) => {
    window.location.href = `/pratiche/${p.id}`
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

      {/* Toolbar — Evalisdesk: flex wrap, gap-2 */}
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

      {/* Kanban Board con DnD */}
      {!isLoading && !error && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
            {PIPELINE_FASI.map(config => (
              <DroppableColumn
                key={config.fase}
                config={config}
                pratiche={pratichePerFase(config.fase)}
                onAvanza={handleAvanza}
              />
            ))}
          </div>

          {/* Drag overlay — phantom card that follows the cursor */}
          <DragOverlay>
            {activePratica && (
              <div className="opacity-90 rotate-2 scale-105">
                <KanbanCard
                  pratica={activePratica}
                  phaseColor="bg-primary"
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
