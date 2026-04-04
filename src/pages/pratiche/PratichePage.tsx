/**
 * PratichePage — lista pratiche con filtri URL, tab navigazione, paginazione.
 *
 * URL params: tab | ricerca | fase | ciclo | norma | stato | assegnato | pagina
 * Cambiare un filtro resetta la pagina e aggiorna la URL (replace) senza
 * aggiungere voci nella history. Il queryKey include tutti i filtri attivi →
 * ogni combinazione di filtri ha la sua cache indipendente.
 *
 * Design ref: ../evalisdesk-ref/src/pages/Pratiche.jsx
 */
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import {
  Plus, Search, Filter, ArrowUpDown, Loader2,
} from 'lucide-react'

import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

import { PraticaRow }   from '@/components/pratiche/PraticaRow'
import { PraticaModal } from '@/components/pratiche/PraticaModal'

import { usePratiche, useSospendiPratica } from '@/hooks/usePratiche'
import { usePratica }      from '@/hooks/usePratiche'
import { useTeamMembers }  from '@/hooks/useTeamMembers'
import { useAuth }         from '@/hooks/useAuth'

import type {
  FaseType, CicloType, StatoPraticaType,
  FiltriPratiche, PraticaListItem,
  PraticaConRelazioni, Cliente, Consulente, UserProfile,
} from '@/types/app.types'
import type { Tables } from '@/lib/supabase'

// ── Costanti UI ───────────────────────────────────────────────────

const PER_PAGINA = 20

const FASE_OPTIONS: { value: FaseType; label: string }[] = [
  { value: 'contratto_firmato',       label: 'Contratto Firmato' },
  { value: 'programmazione_verifica', label: 'Programmazione' },
  { value: 'richiesta_proforma',      label: 'Richiesta Proforma' },
  { value: 'elaborazione_pratica',    label: 'Elaborazione' },
  { value: 'firme',                   label: 'Firme' },
]

const CICLO_OPTIONS: { value: CicloType; label: string }[] = [
  { value: 'certificazione',       label: 'Certificazione' },
  { value: 'prima_sorveglianza',   label: '1ª Sorveglianza' },
  { value: 'seconda_sorveglianza', label: '2ª Sorveglianza' },
  { value: 'ricertificazione',     label: 'Ricertificazione' },
]

const STATO_OPTIONS: { value: StatoPraticaType; label: string }[] = [
  { value: 'attiva',    label: 'Attive' },
  { value: 'sospesa',   label: 'Sospese' },
  { value: 'annullata', label: 'Annullate' },
]

const NORME_LIST = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'SA 8000', 'PAS 24000',
  'PDR 125/2022', 'ESG-EASI', 'ISO 37001', 'ISO 39001', 'ISO 50001',
  'ISO 27001', 'ISO 14064-1', 'ISO 30415', 'ISO 13009', 'ISO 20121',
  'EN 1090', 'ISO 3834',
]

// ── Tipo raw Supabase (getPratiche torna pratiche_norme, non norme) ─

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

// ── Sub-componente: modal modifica con lazy fetch ─────────────────

function EditModal({ praticaId, onClose }: { praticaId: string; onClose: () => void }) {
  const { data, isLoading } = usePratica(praticaId)
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/60 z-50">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }
  return (
    <PraticaModal
      open
      onClose={onClose}
      pratica={data as PraticaConRelazioni | undefined}
    />
  )
}

// ── Paginazione ───────────────────────────────────────────────────

interface PaginazioneProps {
  pagina:        number
  totalePagine:  number
  totale:        number
  onCambia:      (p: number) => void
}

function Paginazione({ pagina, totalePagine, totale, onCambia }: PaginazioneProps) {
  if (totalePagine <= 1) return null
  return (
    <div className="border-t border-border bg-muted/10 px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{totale} pratiche</span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={pagina === 1}
          onClick={() => onCambia(pagina - 1)}
        >
          Precedente
        </Button>
        <span className="text-xs text-muted-foreground px-1">
          {pagina} / {totalePagine}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={pagina === totalePagine}
          onClick={() => onCambia(pagina + 1)}
        >
          Successiva
        </Button>
      </div>
    </div>
  )
}

// ── Componente principale ─────────────────────────────────────────

export default function PratichePage() {
  const navigate         = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin, userProfile } = useAuth()
  const { data: team = [] } = useTeamMembers()

  const isResponsabile = userProfile?.ruolo === 'responsabile'
  const puoFiltareAssegnato = isAdmin || isResponsabile

  // ── State locale: modal nuova pratica / modifica ──────────────
  const [nuovaOpen,   setNuovaOpen]   = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)

  // ── Lettura URL params ────────────────────────────────────────
  const tab       = (searchParams.get('tab') ?? 'attive') as 'attive' | 'completate'
  const ricerca   = searchParams.get('ricerca')   ?? ''
  const fase      = searchParams.get('fase')      as FaseType        | null
  const ciclo     = searchParams.get('ciclo')     as CicloType       | null
  const norma     = searchParams.get('norma')
  const stato     = searchParams.get('stato')     as StatoPraticaType | null
  const assegnato = searchParams.get('assegnato')
  const scadenze  = searchParams.get('scadenze')  // 'critiche' → scadenza ≤ +15gg
  const pagina    = Math.max(1, parseInt(searchParams.get('pagina') ?? '1', 10))

  // scadenze=critiche → filtra pratiche con data_scadenza entro 15 giorni
  const scadenzaMax = scadenze === 'critiche'
    ? format(addDays(new Date(), 15), 'yyyy-MM-dd')
    : null

  // ── Helper aggiornamento URL ──────────────────────────────────
  const setParam = (key: string, value: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'pagina') next.delete('pagina') // reset pagina su cambio filtro
      return next
    }, { replace: true })
  }

  const setTab = (t: 'attive' | 'completate') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', t)
      // Reset filtri specifici della fase/completata
      next.delete('fase')
      next.delete('pagina')
      return next
    }, { replace: true })
  }

  // ── Build filtri query ────────────────────────────────────────
  const filtriQuery: FiltriPratiche = {
    ...(ricerca      ? { ricerca }                     : {}),
    ...(tab === 'completate'
          ? { fase: 'completata' as FaseType }
          : fase ? { fase } : {}),
    ...(ciclo        ? { ciclo }                       : {}),
    ...(norma        ? { norma_codice: norma }         : {}),
    ...(stato        ? { stato }                       : {}),
    ...(assegnato    ? { assegnato_a: assegnato }      : {}),
    ...(scadenzaMax  ? { scadenza_max: scadenzaMax }   : {}),
  }

  const { data: rawData = [], isLoading, error } = usePratiche(filtriQuery)
  const sospendiMut = useSospendiPratica()

  // ── Trasformazione + client-filter ───────────────────────────
  const praticheRaw = rawData as unknown as PraticaListRaw[]

  // Tab "attive" = tutte le fasi eccetto completata (completata ha la sua tab)
  const praticheFiltrate = tab === 'attive'
    ? praticheRaw.filter(p => p.fase !== 'completata')
    : praticheRaw

  // ── Paginazione client-side ───────────────────────────────────
  const totale      = praticheFiltrate.length
  const totalePagine = Math.max(1, Math.ceil(totale / PER_PAGINA))
  const praticheVisibili  = praticheFiltrate
    .slice((pagina - 1) * PER_PAGINA, pagina * PER_PAGINA)
    .map(toListItem)

  // ── Conteggio per tab ─────────────────────────────────────────
  const countAttive     = praticheRaw.filter(p => p.fase !== 'completata').length
  const countCompletate = praticheRaw.filter(p => p.fase === 'completata').length

  // ── Action handlers ───────────────────────────────────────────
  const handleModifica = (p: PraticaListItem) => setEditId(p.id)

  const handleAvanza = (p: PraticaListItem) => navigate(`/pratiche/${p.id}`)

  const handleSospendi = async (p: PraticaListItem) => {
    if (!window.confirm(`Sospendere la pratica ${p.numero_pratica ?? p.id}?`)) return
    try {
      await sospendiMut.mutateAsync({ id: p.id })
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleAnnulla = async (p: PraticaListItem) => {
    // Implementazione completa con modal motivo prevista in F6
    navigate(`/pratiche/${p.id}`)
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-0 max-w-[1600px]">

      {/* Header pagina */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold font-poppins text-foreground">Pratiche</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestione pratiche di certificazione
          </p>
        </div>
      </div>

      {/* Toolbar: stile monday.com / Evalisdesk */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Nuova Pratica */}
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-4 text-sm font-medium rounded-md"
          onClick={() => setNuovaOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nuova Pratica
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Ricerca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cerca pratica..."
            value={ricerca}
            onChange={e => setParam('ricerca', e.target.value || null)}
            className="pl-8 h-8 bg-muted/40 border-border/60 text-sm w-44 focus:w-56 transition-all"
          />
        </div>

        {/* Filtro Norma */}
        <Select value={norma ?? 'all'} onValueChange={v => setParam('norma', v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <SelectValue placeholder="Norma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le norme</SelectItem>
            {NORME_LIST.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Filtro Fase (solo tab attive) */}
        {tab === 'attive' && (
          <Select value={fase ?? 'all'} onValueChange={v => setParam('fase', v === 'all' ? null : v)}>
            <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <SelectValue placeholder="Fase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le fasi</SelectItem>
              {FASE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Filtro Ciclo */}
        <Select value={ciclo ?? 'all'} onValueChange={v => setParam('ciclo', v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5">
            <SelectValue placeholder="Ciclo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i cicli</SelectItem>
            {CICLO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Filtro Stato */}
        <Select value={stato ?? 'all'} onValueChange={v => setParam('stato', v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {STATO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Filtro Assegnato (admin / responsabile) */}
        {puoFiltareAssegnato && (
          <Select value={assegnato ?? 'all'} onValueChange={v => setParam('assegnato', v === 'all' ? null : v)}>
            <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5">
              <SelectValue placeholder="Assegnato a" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli assegnati</SelectItem>
              {team.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {[u.nome, u.cognome].filter(Boolean).join(' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tab switcher (destra) */}
        <div className="ml-auto flex items-center gap-1 bg-muted rounded-md p-0.5">
          <button
            onClick={() => setTab('attive')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tab === 'attive'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Attive
            {!isLoading && (
              <span className="ml-1.5 text-[10px] opacity-60">({countAttive})</span>
            )}
          </button>
          <button
            onClick={() => setTab('completate')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tab === 'completate'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Completate
            {!isLoading && (
              <span className="ml-1.5 text-[10px] opacity-60">({countCompletate})</span>
            )}
          </button>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">

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

        {/* Tabella dati */}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="w-8 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-border accent-primary"
                      aria-label="Seleziona tutto"
                    />
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 min-w-[200px]">
                    Pratica / Cliente
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Assegnato
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 min-w-[130px]">
                    Fase
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Stato
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Scadenza
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Norme
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Ciclo
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Contatto
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Check
                  </th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {praticheVisibili.map(p => (
                  <PraticaRow
                    key={p.id}
                    pratica={p}
                    isAdmin={isAdmin}
                    onModifica={handleModifica}
                    onAvanza={handleAvanza}
                    onSospendi={handleSospendi}
                    onAnnulla={handleAnnulla}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stato vuoto */}
        {!isLoading && !error && praticheVisibili.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Nessuna pratica trovata</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Prova a cambiare i filtri attivi o{' '}
              <button
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setNuovaOpen(true)}
              >
                crea una nuova pratica
              </button>
            </p>
          </div>
        )}

        {/* Footer paginazione */}
        {!isLoading && !error && (
          <Paginazione
            pagina={pagina}
            totalePagine={totalePagine}
            totale={totale}
            onCambia={p => setParam('pagina', String(p))}
          />
        )}
      </div>

      {/* Modal nuova pratica */}
      <PraticaModal
        open={nuovaOpen}
        onClose={() => setNuovaOpen(false)}
      />

      {/* Modal modifica pratica (carica dati completi on-demand) */}
      {editId && (
        <EditModal
          praticaId={editId}
          onClose={() => setEditId(null)}
        />
      )}

    </div>
  )
}
