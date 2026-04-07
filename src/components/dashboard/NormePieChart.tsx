/**
 * NormePieChart — Grafico a ciambella con toggle Norme/Fasi.
 *
 * Design identico a evalisdesk-ref/src/components/dashboard/NormePieChart.jsx
 * Dati reali da useDashboardStats() (pratiche_per_norma + pratiche_per_fase).
 */
import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboardStats } from '@/hooks/useDashboard'
import type { FaseType } from '@/types/app.types'

// ── Colori ───────────────────────────────────────────────────────

const NORM_COLORS = [
  'hsl(213,100%,46%)',
  'hsl(263,46%,47%)',
  'hsl(151,64%,51%)',
  'hsl(37,97%,69%)',
  'hsl(351,75%,62%)',
  'hsl(213,60%,65%)',
  'hsl(263,30%,65%)',
  'hsl(151,40%,65%)',
]

const PHASE_COLORS: Record<string, string> = {
  contratto_firmato:       'hsl(213,100%,46%)',
  programmazione_verifica: 'hsl(263,46%,47%)',
  richiesta_proforma:      'hsl(37,97%,69%)',
  elaborazione_pratica:    'hsl(151,64%,51%)',
  firme:                   'hsl(351,75%,62%)',
}

const FASE_SHORT: Record<FaseType, string> = {
  contratto_firmato:       'Contratto',
  programmazione_verifica: 'Verifica',
  richiesta_proforma:      'Proforma',
  elaborazione_pratica:    'Elaborazione',
  firme:                   'Firme',
  completata:              'Completata',
}

const FASE_FULL: Record<FaseType, string> = {
  contratto_firmato:       'Contratto Firmato',
  programmazione_verifica: 'Programmazione Verifica',
  richiesta_proforma:      'Richiesta Proforma',
  elaborazione_pratica:    'Elaborazione Pratica',
  firme:                   'Firme',
  completata:              'Completata',
}

const FASE_ORDER: FaseType[] = [
  'contratto_firmato',
  'programmazione_verifica',
  'richiesta_proforma',
  'elaborazione_pratica',
  'firme',
]

// ── Tipi interni ─────────────────────────────────────────────────

interface ChartItem {
  name:     string
  fullName: string
  value:    number
  color?:   string
}

// ── Tooltip custom — identico a evalisdesk ───────────────────────

interface TooltipPayload {
  payload: ChartItem
}

function CustomTooltip({ active, payload, mode }: {
  active?: boolean
  payload?: TooltipPayload[]
  mode: 'norme' | 'fasi'
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const label = mode === 'fasi' ? item.fullName || item.name : item.name
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">{item.value} pratica{item.value !== 1 ? 'he' : ''}</p>
    </div>
  )
}

// ── Componente ───────────────────────────────────────────────────

export function NormePieChart() {
  const [mode, setMode] = useState<'norme' | 'fasi'>('norme')
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const { data: stats } = useDashboardStats()

  // Build dati norme
  const normeData: ChartItem[] = (stats?.pratiche_per_norma ?? []).map(n => ({
    name:     n.norma,
    fullName: n.norma,
    value:    n.count,
  }))

  // Build dati fasi
  const perFase = stats?.pratiche_per_fase ?? {}
  const fasiData: ChartItem[] = FASE_ORDER
    .map(fase => ({
      name:     FASE_SHORT[fase],
      fullName: FASE_FULL[fase],
      value:    perFase[fase] ?? 0,
      color:    PHASE_COLORS[fase],
    }))
    .filter(d => d.value > 0)

  const data = mode === 'norme' ? normeData : fasiData
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">
            {mode === 'norme' ? 'Norme in Gestione' : 'Distribuzione per Fase'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{total} pratiche attive</p>
        </div>
        {/* Toggle — identico a evalisdesk */}
        <div className="flex bg-muted rounded-lg p-0.5 shrink-0">
          {(['norme', 'fasi'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setActiveIdx(null) }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                mode === m
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'norme' ? 'Norme' : 'Fasi'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Donut chart */}
        <div className="h-44 relative">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="78%"
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, idx) => setActiveIdx(idx)}
                  onMouseLeave={() => setActiveIdx(null)}
                  stroke="none"
                >
                  {data.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color ?? NORM_COLORS[idx % NORM_COLORS.length]}
                      opacity={activeIdx === null || activeIdx === idx ? 1 : 0.35}
                      style={{ transition: 'opacity 0.2s', cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip mode={mode} />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Nessun dato
            </div>
          )}
          {data.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-poppins text-foreground">{total}</span>
              <span className="text-[11px] text-muted-foreground">pratiche</span>
            </div>
          )}
        </div>

        {/* Legend — identica a evalisdesk */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {data.map((entry, idx) => (
            <div
              key={entry.name}
              className="flex items-center gap-2 cursor-default"
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: entry.color ?? NORM_COLORS[idx % NORM_COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground truncate">{entry.name}</span>
              <span className="text-xs font-semibold text-foreground ml-auto shrink-0">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
