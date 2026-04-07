/**
 * ArchivioPage — pratiche archiviate, raggruppate per anno di completamento.
 *
 * Vista storica: nessun workflow attivo. Solo visualizzazione + ripristino (admin).
 * URL params: ricerca | anno | norma | ciclo | pagina
 *
 * Design ref: pattern PratichePage / PromemoriaPage (Evalisdesk table style)
 */
import { useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Search, Filter, Archive, MoreHorizontal,
  ExternalLink, RotateCcw, Loader2, FolderOpen,
} from 'lucide-react'

import { Input }  from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { BadgeCiclo }   from '@/components/shared/BadgeCiclo'
import { BadgeUrgenza } from '@/components/shared/BadgeUrgenza'

import { usePratiche, useRipristinaPratica } from '@/hooks/usePratiche'
import { useAuth } from '@/hooks/useAuth'

import type { CicloType, FiltriPratiche } from '@/types/app.types'
import type { Tables } from '@/lib/supabase'

// ── Costanti UI ───────────────────────────────────────────────────

const PER_PAGINA = 25

const CICLO_OPTIONS: { value: CicloType; label: string }[] = [
  { value: 'certificazione',       label: 'Certificazione' },
  { value: 'prima_sorveglianza',   label: '1ª Sorveglianza' },
  { value: 'seconda_sorveglianza', label: '2ª Sorveglianza' },
  { value: 'ricertificazione',     label: 'Ricertificazione' },
]

const NORME_LIST = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'SA 8000', 'PAS 24000',
  'PDR 125/2022', 'ESG-EASI', 'ISO 37001', 'ISO 39001', 'ISO 50001',
  'ISO 27001', 'ISO 14064-1', 'ISO 30415', 'ISO 13009', 'ISO 20121',
  'EN 1090', 'ISO 3834',
]

// ── Tipo raw (getPratiche ritorna pratiche_norme, non norme flat) ─

type PraticaArchivioRaw = Tables<'pratiche'> & {
  cliente: { id: string; nome: string; ragione_sociale: string | null } | null
  pratiche_norme: { norma_codice: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM yyyy', { locale: it }) }
  catch { return d }
}

function getAnno(d: string | null | undefined): string {
  if (!d) return 'Anno non disponibile'
  try { return format(parseISO(d), 'yyyy') }
  catch { return 'Anno non disponibile' }
}

// ── Paginazione ───────────────────────────────────────────────────

interface PaginazioneProps {
  pagina:       number
  totalePagine: number
  totale:       number
  onCambia:     (p: number) => void
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

export default function ArchivioPage() {
  const navigate                         = useNavigate()
  const [searchParams, setSearchParams]  = useSearchParams()
  const { isAdmin }                      = useAuth()
  const ripristinaMut                    = useRipristinaPratica()

  // ── URL params ────────────────────────────────────────────────
  const ricerca = searchParams.get('ricerca') ?? ''
  const anno    = searchParams.get('anno')
  const norma   = searchParams.get('norma')
  const ciclo   = searchParams.get('ciclo') as CicloType | null
  const pagina  = Math.max(1, parseInt(searchParams.get('pagina') ?? '1', 10))

  const setParam = (key: string, value: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'pagina') next.delete('pagina')
      return next
    }, { replace: true })
  }

  // ── Query: solo archiviate ────────────────────────────────────
  const filtriQuery: FiltriPratiche = {
    solo_archiviate: true,
    ...(ricerca ? { ricerca } : {}),
    ...(norma   ? { norma_codice: norma } : {}),
    ...(ciclo   ? { ciclo } : {}),
  }

  const { data: rawData = [], isLoading, error } = usePratiche(filtriQuery)
  const pratiche = rawData as unknown as PraticaArchivioRaw[]

  // ── Filtro anno client-side + anni disponibili ────────────────
  const anniDisponibili = useMemo(() => {
    const set = new Set<string>()
    for (const p of pratiche) set.add(getAnno(p.completata_at))
    return Array.from(set).sort((a, b) => b.localeCompare(a)) // desc
  }, [pratiche])

  const praticheFiltrate = useMemo(() => {
    if (!anno) return pratiche
    return pratiche.filter(p => getAnno(p.completata_at) === anno)
  }, [pratiche, anno])

  // ── Raggruppamento per anno ───────────────────────────────────
  const gruppiFull = useMemo(() => {
    const map = new Map<string, PraticaArchivioRaw[]>()
    for (const p of praticheFiltrate) {
      const a = getAnno(p.completata_at)
      if (!map.has(a)) map.set(a, [])
      map.get(a)!.push(p)
    }
    // Ordina anni desc (più recenti prima), "Anno non disponibile" in fondo
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Anno non disponibile') return 1
      if (b === 'Anno non disponibile') return -1
      return b.localeCompare(a)
    })
  }, [praticheFiltrate])

  // ── Paginazione client-side (su flat list, non su gruppi) ─────
  const totale       = praticheFiltrate.length
  const totalePagine = Math.max(1, Math.ceil(totale / PER_PAGINA))
  const offset       = (pagina - 1) * PER_PAGINA

  // Ricostruisce i gruppi paginati
  const gruppiPaginati = useMemo(() => {
    let skip  = 0
    let taken = 0
    const result: { anno: string; righe: PraticaArchivioRaw[] }[] = []

    for (const [a, righe] of gruppiFull) {
      // Quante righe di questo gruppo cadono nell'offset?
      if (skip + righe.length <= offset) {
        skip += righe.length
        continue
      }
      const startInGroup = Math.max(0, offset - skip)
      const slice = righe.slice(startInGroup, startInGroup + (PER_PAGINA - taken))
      if (slice.length > 0) result.push({ anno: a, righe: slice })
      taken += slice.length
      skip  += righe.length
      if (taken >= PER_PAGINA) break
    }
    return result
  }, [gruppiFull, pagina, offset])

  // ── Ripristina ────────────────────────────────────────────────
  async function handleRipristina(p: PraticaArchivioRaw) {
    if (!window.confirm(`Ripristinare la pratica ${p.numero_pratica ?? p.id}?\nTornerà nella lista pratiche standard.`)) return
    try {
      await ripristinaMut.mutateAsync(p.id)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-0">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold font-poppins text-foreground flex items-center gap-2">
            <Archive className="w-5 h-5 text-muted-foreground" />
            Archivio Pratiche
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pratiche completate e archiviate
            {!isLoading && totale > 0 && (
              <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {totale}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">

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

        <div className="w-px h-5 bg-border mx-1" />

        {/* Filtro Anno */}
        <Select value={anno ?? 'all'} onValueChange={v => setParam('anno', v === 'all' ? null : v)}>
          <SelectTrigger className="h-8 px-3 bg-transparent border-border/60 text-sm w-auto gap-1.5">
            <SelectValue placeholder="Anno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli anni</SelectItem>
            {anniDisponibili.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        {/* Stato vuoto */}
        {!isLoading && !error && totale === 0 && (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Nessuna pratica archiviata</p>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Le pratiche completate possono essere archiviate dalla lista Pratiche
            </p>
          </div>
        )}

        {/* Tabella dati */}
        {!isLoading && !error && totale > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 min-w-[220px]">
                    Pratica / Cliente
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Norme
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Ciclo
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Completata il
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Certificato
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">
                    Scadenza Cert.
                  </th>
                  <th className="w-12 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {gruppiPaginati.map(({ anno: a, righe }) => (
                  <AnnoGroup
                    key={a}
                    anno={a}
                    righe={righe}
                    totalGruppo={gruppiFull.find(([ga]) => ga === a)?.[1].length ?? righe.length}
                    isAdmin={isAdmin}
                    isRipristinoLoading={ripristinaMut.isPending}
                    ripristinoId={ripristinaMut.variables as string | undefined}
                    onVisualizza={p => navigate(`/pratiche/${p.id}`)}
                    onRipristina={handleRipristina}
                  />
                ))}
              </tbody>
            </table>
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
    </div>
  )
}

// ── Sub-componente: gruppo anno ───────────────────────────────────

interface AnnoGroupProps {
  anno:                string
  righe:               PraticaArchivioRaw[]
  totalGruppo:         number
  isAdmin:             boolean
  isRipristinoLoading: boolean
  ripristinoId:        string | undefined
  onVisualizza:        (p: PraticaArchivioRaw) => void
  onRipristina:        (p: PraticaArchivioRaw) => void
}

function AnnoGroup({
  anno, righe, totalGruppo, isAdmin,
  isRipristinoLoading, ripristinoId,
  onVisualizza, onRipristina,
}: AnnoGroupProps) {
  return (
    <>
      {/* Header gruppo anno */}
      <tr className="bg-muted/40 border-b border-border">
        <td colSpan={7} className="px-3 py-2">
          <span className="text-xs font-semibold text-foreground">{anno}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            — {totalGruppo} {totalGruppo === 1 ? 'pratica' : 'pratiche'}
          </span>
        </td>
      </tr>

      {/* Righe pratica */}
      {righe.map(p => (
        <tr
          key={p.id}
          className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group cursor-pointer"
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.closest('button, a, [role="menuitem"], [data-radix-collection-item]')) return
            onVisualizza(p)
          }}
        >
          {/* Pratica / Cliente */}
          <td className="px-3 py-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono text-muted-foreground">
                {p.numero_pratica ?? '—'}
              </span>
              <span className="text-sm font-medium text-foreground leading-snug">
                {p.cliente?.nome ?? p.cliente?.ragione_sociale ?? '—'}
              </span>
            </div>
          </td>

          {/* Norme */}
          <td className="px-3 py-3.5">
            <div className="flex flex-wrap gap-1">
              {p.pratiche_norme.length > 0
                ? p.pratiche_norme.slice(0, 3).map(pn => (
                    <span
                      key={pn.norma_codice}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {pn.norma_codice}
                    </span>
                  ))
                : <span className="text-xs text-muted-foreground">—</span>
              }
              {p.pratiche_norme.length > 3 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                  +{p.pratiche_norme.length - 3}
                </span>
              )}
            </div>
          </td>

          {/* Ciclo */}
          <td className="px-3 py-3.5">
            {p.ciclo
              ? <BadgeCiclo ciclo={p.ciclo} />
              : <span className="text-xs text-muted-foreground">—</span>
            }
          </td>

          {/* Completata il */}
          <td className="px-3 py-3.5">
            <span className="text-sm text-foreground">{fmtData(p.completata_at)}</span>
          </td>

          {/* Numero certificato */}
          <td className="px-3 py-3.5">
            {p.numero_certificato
              ? <span className="text-sm font-mono text-foreground">{p.numero_certificato}</span>
              : <span className="text-xs text-muted-foreground">—</span>
            }
          </td>

          {/* Scadenza certificato */}
          <td className="px-3 py-3.5">
            <BadgeUrgenza dataScadenza={p.data_scadenza_certificato} />
          </td>

          {/* Azioni */}
          <td className="px-3 py-3.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onVisualizza(p)}>
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Visualizza
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => onRipristina(p)}
                    disabled={isRipristinoLoading && ripristinoId === p.id}
                    className="text-warning focus:text-warning"
                  >
                    {isRipristinoLoading && ripristinoId === p.id
                      ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      : <RotateCcw className="w-3.5 h-3.5 mr-2" />
                    }
                    Ripristina
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      ))}
    </>
  )
}
