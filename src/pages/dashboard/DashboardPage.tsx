/**
 * DashboardPage — panoramica KPI, scadenze, distribuzione fasi, attività.
 *
 * Design ref: ../evalisdesk-ref/src/pages/Dashboard.jsx
 *             ../evalisdesk-ref/src/components/dashboard/
 *             ../evalisdesk-ref/src/components/shared/StatsCard.jsx
 *
 * Sezioni:
 *   1. Greeting + data
 *   2. KPI cards (4) — cliccabili verso pratiche filtrate
 *   3. Scadenze urgenti (tabella 5 righe) + Distribuzione fasi (barre)
 *   4. Ultime attività (timeline) + Le mie pratiche (lista)
 */
import { Link, useNavigate }      from 'react-router-dom'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { it }                     from 'date-fns/locale'
import {
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

import { useDashboardStats, useUltimaAttivita } from '@/hooks/useDashboard'
import { usePratiche }                          from '@/hooks/usePratiche'
import { useAuth }                              from '@/hooks/useAuth'
import { BadgeFase }                            from '@/components/shared/BadgeFase'
import { BadgeUrgenza }                         from '@/components/shared/BadgeUrgenza'
import { NormePieChart }                        from '@/components/dashboard/NormePieChart'

import type { Tables }                          from '@/lib/supabase'
import type { Cliente, Consulente, UserProfile, FaseType, StoricoFaseConUtente } from '@/types/app.types'

// ── Tipo raw Supabase (speculare a PratichePage) ──────────────────

type PraticaListRaw = Tables<'pratiche'> & {
  cliente:        Pick<Cliente, 'id' | 'nome' | 'ragione_sociale'>
  consulente:     Pick<Consulente, 'id' | 'nome' | 'cognome'> | null
  assegnato:      Pick<UserProfile, 'id' | 'nome' | 'cognome' | 'avatar_url'> | null
  pratiche_norme: { norma_codice: string }[]
}

// ── Costanti ──────────────────────────────────────────────────────

const FASE_LABELS: Record<FaseType, string> = {
  contratto_firmato:       'Contratto Firmato',
  programmazione_verifica: 'Programmazione Verifica',
  richiesta_proforma:      'Richiesta Proforma',
  elaborazione_pratica:    'Elaborazione Pratica',
  firme:                   'Firme',
  completata:              'Completata',
}

const FASE_SHORT: Record<FaseType, string> = {
  contratto_firmato:       'Contratto',
  programmazione_verifica: 'Verifica',
  richiesta_proforma:      'Proforma',
  elaborazione_pratica:    'Elaborazione',
  firme:                   'Firme',
  completata:              'Completata',
}

const FASE_ORDER: FaseType[] = [
  'contratto_firmato',
  'programmazione_verifica',
  'richiesta_proforma',
  'elaborazione_pratica',
  'firme',
  'completata',
]

// Colori barre distribuzione fasi — speculare a evalisdesk PhaseDistribution
const FASE_BAR_COLORS: Record<FaseType, string> = {
  contratto_firmato:       'bg-phase-1',
  programmazione_verifica: 'bg-phase-2',
  richiesta_proforma:      'bg-phase-3',
  elaborazione_pratica:    'bg-phase-4',
  firme:                   'bg-phase-5',
  completata:              'bg-muted-foreground/30',
}

// ── Helpers ───────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 18) return 'Buonasera'
  if (h >= 13) return 'Buon pomeriggio'
  return 'Buongiorno'
}

function getItalianDate(): string {
  const now = new Date()
  return format(now, "EEEE, d MMMM yyyy", { locale: it })
}

function nomeCompleto(
  u: { nome: string | null; cognome: string | null } | null | undefined,
): string {
  if (!u) return 'Sistema'
  return [u.nome, u.cognome].filter(Boolean).join(' ') || 'Sistema'
}

function buildEventText(item: StoricoFaseConUtente): string {
  if (!item.fase_precedente)
    return `ha creato la pratica in fase ${FASE_LABELS[item.fase_nuova]}`
  if (item.fase_nuova === 'completata')
    return 'ha completato la pratica'
  return `ha avanzato la pratica a ${FASE_LABELS[item.fase_nuova]}`
}

function fmtRelativo(d: string | null | undefined): string {
  if (!d) return ''
  try {
    return formatDistanceToNow(parseISO(d), { addSuffix: true, locale: it })
  } catch {
    return d
  }
}

// ── Componente interno: KPI Card ──────────────────────────────────
// Speculare a evalisdesk StatsCard.jsx

interface KpiCardProps {
  title:      string
  value:      number | undefined
  icon:       React.ElementType
  color:      string          // bg-* classe Tailwind per l'icona
  trend?:     number          // opzionale — % rispetto mese scorso
  trendLabel?: string
  href:       string          // link pratica filtrata
  loading?:   boolean
}

function KpiCard({ title, value, icon: Icon, color, trend, trendLabel, href, loading }: KpiCardProps) {
  return (
    <Link
      to={href}
      className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow duration-200 group relative overflow-hidden block"
    >
      {/* Cerchio decorativo background — da evalisdesk */}
      <div className={`absolute -right-3 -top-3 w-20 h-20 rounded-full opacity-[0.06] ${color}`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4.5 h-4.5 text-white" strokeWidth={2} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend > 0
                ? 'bg-success/10 text-success'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {trend > 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-10 w-16 bg-muted/50 rounded animate-pulse mb-1" />
        ) : (
          <p className="text-4xl font-light text-foreground tracking-tight tabular-nums">
            {value ?? 0}
          </p>
        )}

        <p className="text-xs font-medium text-muted-foreground mt-1.5">{title}</p>
        {trendLabel && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{trendLabel}</p>
        )}
      </div>
    </Link>
  )
}

// ── Componente principale ─────────────────────────────────────────

export default function DashboardPage() {
  const navigate                            = useNavigate()
  const { user, userProfile } = useAuth()

  // ── Dati ──────────────────────────────────────────────────────
  const { data: stats, isLoading: loadingStats }       = useDashboardStats()
  const { data: attivita = [], isLoading: loadingAtt } = useUltimaAttivita()

  // Pratiche attive ordinate per scadenza — usate per scadenze urgenti + le mie
  const { data: rawPratiche = [] } = usePratiche({
    solo_attive: true,
    ordinamento: 'data_scadenza',
    direzione:   'asc',
  })
  const tutteRaw = rawPratiche as unknown as PraticaListRaw[]

  // Prossime 5 pratiche a scadere con data_scadenza valorizzata
  const scadenzeUrgenti = tutteRaw
    .filter((p) => !!p.data_scadenza)
    .slice(0, 5)

  // "Le mie pratiche" — pratiche assegnate all'utente corrente
  const miePratiche = tutteRaw
    .filter((p) => p.assegnato_a === user?.id)
    .slice(0, 4)

  // Distribuzione per fase
  const perFase = stats?.pratiche_per_fase ?? {}

  const maxFaseCount = Math.max(
    ...FASE_ORDER.map((f) => perFase[f] ?? 0),
    1,
  )

  // ── Render ────────────────────────────────────────────────────
  const nomePrincipale = userProfile?.nome ?? 'utente'

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* ── Greeting — da evalisdesk Dashboard.jsx ──────────────── */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {getGreeting()}, {nomePrincipale} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5 capitalize">{getItalianDate()}</p>
      </div>

      {/* ── KPI Cards — 4 colonne, da evalisdesk StatsCard.jsx ──── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pratiche Attive"
          value={stats?.pratiche_attive}
          icon={FolderKanban}
          color="bg-primary"
          href="/pratiche"
          loading={loadingStats}
        />
        <KpiCard
          title="Scadenze Critiche"
          value={stats?.scadenze_critiche}
          icon={AlertTriangle}
          color="bg-destructive"
          href="/pratiche?scadenze=critiche"
          loading={loadingStats}
        />
        <KpiCard
          title="Completate questo Mese"
          value={stats?.completate_questo_mese}
          icon={CheckCircle2}
          color="bg-success"
          href="/pratiche"
          loading={loadingStats}
        />
        <KpiCard
          title="Bloccate (Doc. Mancanti)"
          value={stats?.pratiche_bloccate}
          icon={FileWarning}
          color="bg-warning"
          href="/pratiche?fase=elaborazione_pratica"
          loading={loadingStats}
        />
      </div>

      {/* ── Middle row: Scadenze (3) + Distribuzione Fasi (2) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Scadenze Urgenti — da evalisdesk DeadlinesTable.jsx */}
        <div className="lg:col-span-3">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Scadenze Urgenti</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Cliente</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Norme</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Fase</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Scadenza</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {scadenzeUrgenti.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted-foreground">
                        Nessuna scadenza imminente
                      </td>
                    </tr>
                  ) : (
                    scadenzeUrgenti.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          if (target.closest('a, button')) return
                          navigate(`/pratiche/${p.id}`)
                        }}
                      >
                        <td className="px-5 py-3">
                          <span className="text-sm font-medium text-foreground">
                            {p.cliente?.nome ?? p.cliente?.ragione_sociale ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm text-muted-foreground">
                            {p.pratiche_norme.map((n) => n.norma_codice).join(', ') || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <BadgeFase fase={p.fase} short />
                        </td>
                        <td className="px-5 py-3">
                          <BadgeUrgenza dataScadenza={p.data_scadenza} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            to={`/pratiche/${p.id}`}
                            className="text-primary hover:text-primary/80 transition-colors"
                            aria-label="Apri pratica"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Distribuzione Fasi + NormePieChart — da evalisdesk */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Distribuzione Fasi</h3>
            </div>
            <div className="p-5 space-y-4">
              {FASE_ORDER.filter((f) => f !== 'completata').map((fase) => {
                const count = perFase[fase] ?? 0
                return (
                  <div key={fase} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{FASE_SHORT[fase]}</span>
                      <span className="text-sm font-semibold text-foreground">{count}</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${FASE_BAR_COLORS[fase]} transition-all duration-700 ease-out`}
                        style={{ width: `${(count / maxFaseCount) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <NormePieChart />
        </div>
      </div>

      {/* ── Bottom row: Attività recente + Le mie pratiche ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Ultime Attività — da evalisdesk ActivityFeed.jsx */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Attività Recente</h3>
          </div>
          <div className="p-5">
            {loadingAtt ? (
              <p className="text-sm text-muted-foreground text-center py-4">Caricamento…</p>
            ) : attivita.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività registrata</p>
            ) : (
              <div className="relative">
                {/* Linea verticale timeline — da evalisdesk ActivityFeed */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                <div className="space-y-5">
                  {attivita.map((item) => (
                    <div key={item.id} className="flex gap-4 relative">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center shrink-0 z-10">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{nomeCompleto(item.cambiato_da_profile)}</span>{' '}
                          <span className="text-muted-foreground">{buildEventText(item)}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/pratiche/${item.pratica_id}`)}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Vai alla pratica
                          </button>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{fmtRelativo(item.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Le mie pratiche — da evalisdesk Dashboard.jsx sezione "Le mie pratiche" */}
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-lg font-semibold text-foreground">Le mie pratiche</h3>
            <span className="text-sm text-muted-foreground">({miePratiche.length} attive)</span>
          </div>

          {miePratiche.length === 0 ? (
            <div className="bg-card rounded-xl border border-border px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">Nessuna pratica assegnata</p>
            </div>
          ) : (
            <div className="space-y-2">
              {miePratiche.map((p) => (
                <div
                  key={p.id}
                  className="bg-card rounded-lg border border-border px-4 py-3 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.closest('a, button')) return
                    navigate(`/pratiche/${p.id}`)
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {p.cliente?.nome ?? p.cliente?.ragione_sociale ?? '—'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {p.pratiche_norme.slice(0, 3).map((n) => (
                          <span
                            key={n.norma_codice}
                            className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground"
                          >
                            {n.norma_codice}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BadgeFase fase={p.fase} short />
                    <BadgeUrgenza dataScadenza={p.data_scadenza} />
                    <Link
                      to={`/pratiche/${p.id}`}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Apri →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/pratiche"
            className="text-sm text-primary hover:text-primary/80 font-medium mt-3 inline-block"
          >
            Vedi tutte le pratiche →
          </Link>
        </div>

      </div>
    </div>
  )
}
