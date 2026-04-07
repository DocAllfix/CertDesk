/**
 * ScadenzePage — vista scadenze con riepilogo urgenze, filtri e checklist inline.
 *
 * Design ref: ../evalisdesk-ref/src/components/shared/DocumentChecklist.jsx
 *             ../evalisdesk-ref/src/components/shared/UrgencyBadge.jsx
 *             ../evalisdesk-ref/src/components/shared/StatsCard.jsx
 *             ../evalisdesk-ref/src/components/dashboard/DeadlinesTable.jsx
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { differenceInDays, parseISO, format } from 'date-fns'
import {
  AlertTriangle, Clock, CheckCircle2,
  ArrowRight, FileText, Calendar, Receipt, Filter, Loader2,
  Check, X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

import { BadgeFase }    from '@/components/shared/BadgeFase'
import { BadgeUrgenza } from '@/components/shared/BadgeUrgenza'
import { BadgeCiclo }   from '@/components/shared/BadgeCiclo'

import { usePratiche, useUpdatePratica } from '@/hooks/usePratiche'
import { toast } from 'sonner'

import type { Tables } from '@/lib/supabase'
import type { Cliente, Consulente, UserProfile } from '@/types/app.types'

// ── Tipo raw Supabase ─────────────────────────────────────────────

type PraticaScadenzaRaw = Tables<'pratiche'> & {
  cliente:        Pick<Cliente, 'id' | 'nome' | 'ragione_sociale'>
  consulente:     Pick<Consulente, 'id' | 'nome' | 'cognome'> | null
  assegnato:      Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url'> | null
  pratiche_norme: { norma_codice: string }[]
}

// ── Costanti ──────────────────────────────────────────────────────

type UrgencyFilter = 'tutte' | 'critiche' | 'attenzione'

const NORME_LIST = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'SA 8000', 'PAS 24000',
  'PDR 125/2022', 'ESG-EASI', 'ISO 37001', 'ISO 39001', 'ISO 50001',
  'ISO 27001', 'ISO 14064-1', 'ISO 30415', 'ISO 13009', 'ISO 20121',
  'EN 1090', 'ISO 3834',
]

// ── Helpers urgenza ───────────────────────────────────────────────

type UrgencyLevel = 'critical' | 'warning' | 'ok'

function getUrgencyLevel(dataScadenza: string): UrgencyLevel {
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const giorni = differenceInDays(parseISO(dataScadenza), oggi)
  if (giorni <= 15) return 'critical'
  if (giorni <= 45) return 'warning'
  return 'ok'
}

// ── Componente checklist inline ───────────────────────────────────

interface CheckItemProps {
  value:       boolean
  readonly:    boolean
  label:       string
  icon:        React.ReactNode
  onToggle?:   () => void
  loading?:    boolean
}

function CheckItem({ value, readonly, label, icon, onToggle, loading }: CheckItemProps) {
  const base = 'w-6 h-6 rounded flex items-center justify-center transition-all'
  const active = value
    ? 'bg-success/10 text-success border border-success/20'
    : 'bg-muted/50 text-muted-foreground border border-border'

  if (readonly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${base} ${active} cursor-default`}>
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : value ? (
              <Check className="w-3 h-3" />
            ) : (
              <X className="w-3 h-3" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}: {value ? 'Sì' : 'No'}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          disabled={loading}
          className={`${base} ${active} hover:scale-110 cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/20`}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : value ? (
            <Check className="w-3 h-3" />
          ) : (
            icon
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label}: {value ? 'Sì (click per rimuovere)' : 'No (click per segnare)'}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// ── Riga tabella ──────────────────────────────────────────────────

interface RigaScadenzaProps {
  pratica: PraticaScadenzaRaw
}

function RigaScadenza({ pratica }: RigaScadenzaProps) {
  const navigate = useNavigate()
  const updateMut = useUpdatePratica()
  const [loadingField, setLoadingField] = useState<string | null>(null)

  const norme = pratica.pratiche_norme.map(pn => pn.norma_codice)
  const nomeCliente = pratica.cliente?.ragione_sociale || pratica.cliente?.nome || '—'
  const isCompletata = pratica.fase === 'completata'

  const handleToggle = async (field: 'documenti_ricevuti' | 'proforma_emessa' | 'data_verifica') => {
    setLoadingField(field)
    try {
      let update: Record<string, unknown>
      if (field === 'data_verifica') {
        update = { data_verifica: pratica.data_verifica ? null : format(new Date(), 'yyyy-MM-dd') }
      } else {
        update = { [field]: !pratica[field] }
      }
      await updateMut.mutateAsync({ id: pratica.id, data: update })
      toast.success('Aggiornato')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingField(null)
    }
  }

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      {/* Urgenza */}
      <td className="px-4 py-3 w-24">
        <BadgeUrgenza dataScadenza={pratica.data_scadenza} />
      </td>

      {/* Cliente */}
      <td className="px-4 py-3 min-w-[160px]">
        <span className="text-sm font-medium text-foreground">{nomeCliente}</span>
        {pratica.numero_pratica && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{pratica.numero_pratica}</p>
        )}
      </td>

      {/* Norme */}
      <td className="px-4 py-3 min-w-[140px]">
        <div className="flex flex-wrap gap-1">
          {norme.slice(0, 2).map(n => (
            <span key={n} className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {n}
            </span>
          ))}
          {norme.length > 2 && (
            <span className="text-[11px] text-muted-foreground">+{norme.length - 2}</span>
          )}
        </div>
      </td>

      {/* Ciclo */}
      <td className="px-4 py-3">
        {pratica.ciclo ? <BadgeCiclo ciclo={pratica.ciclo} /> : <span className="text-muted-foreground text-xs">—</span>}
      </td>

      {/* Fase */}
      <td className="px-4 py-3">
        <BadgeFase fase={pratica.fase} short />
      </td>

      {/* Checklist inline */}
      <td className="px-4 py-3">
        <TooltipProvider>
          <div className="flex items-center gap-1.5">
            <CheckItem
              value={!!pratica.documenti_ricevuti}
              readonly={false}
              label="Documenti ricevuti"
              icon={<FileText className="w-3 h-3" />}
              onToggle={() => handleToggle('documenti_ricevuti')}
              loading={loadingField === 'documenti_ricevuti'}
            />
            <CheckItem
              value={!!pratica.data_verifica}
              readonly={false}
              label="Data verifica impostata"
              icon={<Calendar className="w-3 h-3" />}
              onToggle={() => handleToggle('data_verifica')}
              loading={loadingField === 'data_verifica'}
            />
            <CheckItem
              value={!!pratica.proforma_emessa}
              readonly={false}
              label="Proforma emessa"
              icon={<Receipt className="w-3 h-3" />}
              onToggle={() => handleToggle('proforma_emessa')}
              loading={loadingField === 'proforma_emessa'}
            />
            <CheckItem
              value={isCompletata}
              readonly
              label="Completata"
              icon={<CheckCircle2 className="w-3 h-3" />}
            />
          </div>
        </TooltipProvider>
      </td>

      {/* Scadenza */}
      <td className="px-4 py-3 whitespace-nowrap">
        {pratica.data_scadenza ? (
          <span className="text-sm text-foreground">
            {format(parseISO(pratica.data_scadenza), 'dd/MM/yyyy')}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      {/* Azioni */}
      <td className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1 text-primary hover:text-primary/80"
          onClick={() => navigate(`/pratiche/${pratica.id}`)}
        >
          Avanza
          <ArrowRight className="w-3 h-3" />
        </Button>
      </td>
    </tr>
  )
}

// ── Componente principale ─────────────────────────────────────────

export default function ScadenzePage() {
  const [urgenzaFilter, setUrgenzaFilter] = useState<UrgencyFilter>('tutte')
  const [normaFilter,   setNormaFilter]   = useState<string>('all')

  const { data: rawData = [], isLoading, error } = usePratiche({
    solo_attive:  true,
    ordinamento:  'data_scadenza',
    direzione:    'asc',
  })

  const tutte = (rawData as unknown as PraticaScadenzaRaw[])
    .filter(p => !!p.data_scadenza)

  // Conteggi per le card
  const nCritiche   = tutte.filter(p => getUrgencyLevel(p.data_scadenza!) === 'critical').length
  const nAttenzione = tutte.filter(p => getUrgencyLevel(p.data_scadenza!) === 'warning').length
  const nNorma      = tutte.filter(p => getUrgencyLevel(p.data_scadenza!) === 'ok').length

  // Filtro applicato
  const filtrate = tutte.filter(p => {
    if (urgenzaFilter === 'critiche'   && getUrgencyLevel(p.data_scadenza!) !== 'critical') return false
    if (urgenzaFilter === 'attenzione' && getUrgencyLevel(p.data_scadenza!) !== 'warning')  return false
    if (normaFilter !== 'all') {
      const hasNorma = p.pratiche_norme.some(pn => pn.norma_codice === normaFilter)
      if (!hasNorma) return false
    }
    return true
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold font-poppins text-foreground">Scadenze</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitoraggio scadenze pratiche attive
        </p>
      </div>

      {/* Riepilogo cards — pattern StatsCard evalisdesk */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Critiche */}
        <button
          onClick={() => setUrgenzaFilter(urgenzaFilter === 'critiche' ? 'tutte' : 'critiche')}
          className={`bg-card rounded-xl border p-5 text-left hover:shadow-md transition-all duration-200 group relative overflow-hidden ${
            urgenzaFilter === 'critiche' ? 'border-destructive/40 ring-1 ring-destructive/30' : 'border-border'
          }`}
        >
          <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-destructive opacity-[0.06]" />
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-destructive flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              {urgenzaFilter === 'critiche' && (
                <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                  Filtro attivo
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="h-10 w-12 bg-muted/50 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-4xl font-light text-foreground tracking-tight tabular-nums">{nCritiche}</p>
            )}
            <p className="text-xs font-medium text-muted-foreground mt-1.5">Critiche (&lt;15gg)</p>
          </div>
        </button>

        {/* Attenzione */}
        <button
          onClick={() => setUrgenzaFilter(urgenzaFilter === 'attenzione' ? 'tutte' : 'attenzione')}
          className={`bg-card rounded-xl border p-5 text-left hover:shadow-md transition-all duration-200 group relative overflow-hidden ${
            urgenzaFilter === 'attenzione' ? 'border-warning/40 ring-1 ring-warning/30' : 'border-border'
          }`}
        >
          <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-warning opacity-[0.06]" />
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-warning flex items-center justify-center shadow-sm">
                <Clock className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              {urgenzaFilter === 'attenzione' && (
                <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">
                  Filtro attivo
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="h-10 w-12 bg-muted/50 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-4xl font-light text-foreground tracking-tight tabular-nums">{nAttenzione}</p>
            )}
            <p className="text-xs font-medium text-muted-foreground mt-1.5">Attenzione (15–45gg)</p>
          </div>
        </button>

        {/* Nella norma */}
        <button
          onClick={() => setUrgenzaFilter('tutte')}
          className="bg-card rounded-xl border border-border p-5 text-left hover:shadow-md transition-all duration-200 group relative overflow-hidden"
        >
          <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-success opacity-[0.06]" />
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-success flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
            </div>
            {isLoading ? (
              <div className="h-10 w-12 bg-muted/50 rounded animate-pulse mb-1" />
            ) : (
              <p className="text-4xl font-light text-foreground tracking-tight tabular-nums">{nNorma}</p>
            )}
            <p className="text-xs font-medium text-muted-foreground mt-1.5">Nella norma (&gt;45gg)</p>
          </div>
        </button>

      </div>

      {/* Tabella */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">

        {/* Toolbar tabella */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-foreground text-sm">
            {urgenzaFilter === 'critiche'   ? 'Scadenze critiche' :
             urgenzaFilter === 'attenzione' ? 'In attenzione' :
             'Tutte le scadenze'}
            {!isLoading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({filtrate.length} pratiche)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {/* Filtro urgenza */}
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
              {(['tutte', 'critiche', 'attenzione'] as UrgencyFilter[]).map(v => (
                <button
                  key={v}
                  onClick={() => setUrgenzaFilter(v)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors capitalize ${
                    urgenzaFilter === v
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v === 'tutte' ? 'Tutte' : v === 'critiche' ? 'Critiche' : 'Attenzione'}
                </button>
              ))}
            </div>

            {/* Filtro norma */}
            <Select value={normaFilter} onValueChange={setNormaFilter}>
              <SelectTrigger className="h-7 px-2.5 bg-transparent border-border/60 text-xs w-auto gap-1.5">
                <Filter className="w-3 h-3 text-muted-foreground" />
                <SelectValue placeholder="Norma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le norme</SelectItem>
                {NORME_LIST.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

        {/* Tabella dati */}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">
                    Urgenza
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 min-w-[160px]">
                    Cliente
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 min-w-[140px]">
                    Norme
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">
                    Ciclo
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">
                    Fase
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 min-w-[120px]">
                    Checklist
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">
                    Scadenza
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-24">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrate.map(p => (
                  <RigaScadenza key={p.id} pratica={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stato vuoto */}
        {!isLoading && !error && filtrate.length === 0 && (
          <div className="py-16 text-center">
            <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">Nessuna scadenza trovata</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {urgenzaFilter !== 'tutte'
                ? 'Prova a cambiare il filtro urgenza'
                : 'Tutte le pratiche sono a posto'}
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
