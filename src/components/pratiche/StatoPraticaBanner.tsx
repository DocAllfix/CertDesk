/**
 * StatoPraticaBanner — Banner per pratiche sospese o annullate.
 *
 * Convertito da: c:\Users\user\Desktop\evalisdesk-ref\src\components\dettaglio\StatoPraticaBanner.jsx
 *
 * Pattern Evalisdesk:
 * - rounded-xl border, flex items-center gap-3, px-4 py-3
 * - Sospesa: bg-warning/10 border-warning/30, icon AlertTriangle, text-warning
 * - Annullata: bg-destructive/10 border-destructive/30, icon Ban, text-destructive
 * - Pulsante "Riattiva" con RotateCcw icon (solo sospesa + onReactivate)
 *
 * Aggiunte CertDesk:
 * - Mostra motivo_stato dal DB (se presente)
 * - Mostra data e autore del cambio stato (stato_cambiato_at, stato_cambiato_da)
 * - Pulsante "Riattiva" disponibile sia per sospesa che annullata (solo admin)
 *   → aggiorna pratica.stato = 'attiva'
 *
 * Campi DB usati (da database.types.ts L372-411):
 * - pratica.stato → 'attiva' | 'sospesa' | 'annullata'
 * - pratica.motivo_stato → string | null
 * - pratica.stato_cambiato_at → string | null
 * - pratica.stato_cambiato_da → string | null (UUID)
 */
import { useState } from 'react'
import { AlertTriangle, Ban, RotateCcw, Loader2 } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth }  from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { praticheKeys }   from '@/hooks/usePratiche'

import type { PraticaConRelazioni } from '@/types/app.types'

// ── Config stati — pattern Evalisdesk ────────────────────────────

const STATUS_CONFIG = {
  sospesa: {
    icon:   AlertTriangle,
    bg:     'bg-warning/10 border-warning/30',
    text:   'text-warning',
    label:  'Pratica Sospesa',
    description: 'Questa pratica è attualmente sospesa. Nessun avanzamento è possibile finché non viene riattivata.',
  },
  annullata: {
    icon:   Ban,
    bg:     'bg-destructive/10 border-destructive/30',
    text:   'text-destructive',
    label:  'Pratica Annullata',
    description: 'Questa pratica è stata annullata e non può essere modificata.',
  },
} as const

// ── Props ─────────────────────────────────────────────────────────

interface StatoPraticaBannerProps {
  pratica: PraticaConRelazioni
}

// ── Componente ────────────────────────────────────────────────────

export function StatoPraticaBanner({ pratica }: StatoPraticaBannerProps) {
  const { user, isAdmin } = useAuth()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  // Mostra solo se non attiva
  if (pratica.stato === 'attiva') return null

  const config = STATUS_CONFIG[pratica.stato]
  if (!config) return null

  const Icon = config.icon

  async function handleRiattiva() {
    if (!user) return
    setLoading(true)

    const { error } = await supabase
      .from('pratiche')
      .update({
        stato:             'attiva',
        motivo_stato:      null,
        stato_cambiato_at: new Date().toISOString(),
        stato_cambiato_da: user.id,
      })
      .eq('id', pratica.id)

    setLoading(false)
    if (!error) {
      qc.invalidateQueries({ queryKey: praticheKeys.all })
    }
  }

  // Formatta data cambio stato
  const dataCambio = pratica.stato_cambiato_at
    ? new Date(pratica.stato_cambiato_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${config.bg}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>

        {/* Motivo dal DB */}
        {pratica.motivo_stato && (
          <p className="text-xs text-foreground mt-1.5 bg-background/50 rounded px-2 py-1 border border-border/40">
            <span className="font-medium">Motivo:</span> {pratica.motivo_stato}
          </p>
        )}

        {/* Data e autore cambio stato */}
        {dataCambio && (
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Cambiato il {dataCambio}
          </p>
        )}
      </div>

      {/* Pulsante Riattiva — solo per admin */}
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleRiattiva}
          disabled={loading}
          className="shrink-0 gap-1.5 cursor-pointer"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RotateCcw className="w-3.5 h-3.5" />}
          Riattiva
        </Button>
      )}
    </div>
  )
}
