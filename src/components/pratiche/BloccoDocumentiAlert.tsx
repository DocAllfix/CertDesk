/**
 * BloccoDocumentiAlert — Alert fase 4 bloccata per documenti mancanti.
 *
 * Convertito da: c:\Users\user\Desktop\evalisdesk-ref\src\components\dettaglio\BloccoDocumentiAlert.jsx
 *
 * Pattern Evalisdesk:
 * - rounded-xl border bg-destructive/5 border-destructive/20
 * - AlertTriangle icon, text-sm font-semibold
 * - text-xs text-muted-foreground per sottotesto
 *
 * Aggiunta CertDesk:
 * - Pulsante "Segna documenti ricevuti" → update + notifica
 * - Mostra solo se pratica.fase === 'elaborazione_pratica' && !documenti_ricevuti
 *
 * Campi DB usati (da database.types.ts L372-411):
 * - pratica.fase → fase_type
 * - pratica.documenti_ricevuti → boolean | null
 * - pratica.documenti_ricevuti_at → string | null
 */
import { useState } from 'react'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { Button }    from '@/components/ui/button'
import { supabase }  from '@/lib/supabase'
import { useAuth }   from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { praticheKeys }   from '@/hooks/usePratiche'
import { notifyDocumentiRicevuti } from '@/lib/workflow'

import type { PraticaConRelazioni } from '@/types/app.types'

// ── Props ─────────────────────────────────────────────────────────

interface BloccoDocumentiAlertProps {
  pratica: PraticaConRelazioni
}

// ── Componente ────────────────────────────────────────────────────

export function BloccoDocumentiAlert({ pratica }: BloccoDocumentiAlertProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  // Mostra solo in fase 4 senza documenti
  if (pratica.fase !== 'elaborazione_pratica' || pratica.documenti_ricevuti) {
    return null
  }

  async function handleSegnaRicevuti() {
    if (!user) return
    setLoading(true)

    const { error } = await supabase
      .from('pratiche')
      .update({
        documenti_ricevuti:    true,
        documenti_ricevuti_at: new Date().toISOString(),
        updated_by:            user.id,
      })
      .eq('id', pratica.id)

    if (error) {
      setLoading(false)
      return
    }

    // Notifica best-effort
    notifyDocumentiRicevuti(
      { id: pratica.id, numero_pratica: pratica.numero_pratica, assegnato_a: pratica.assegnato_a },
    ).catch(() => {})

    // Invalida cache
    qc.invalidateQueries({ queryKey: praticheKeys.all })

    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-success/5 border-success/20">
        <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-success">Documenti ricevuti</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            È ora possibile avanzare alla fase Firme.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-destructive/5 border-destructive/20">
      <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-destructive">
          Elaborazione bloccata — Documenti non ancora ricevuti
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          La pratica non può avanzare alla fase Firme finché i documenti non vengono ricevuti.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleSegnaRicevuti}
        disabled={loading}
        className="shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
      >
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <CheckCircle className="w-3.5 h-3.5" />}
        Segna ricevuti
      </Button>
    </div>
  )
}
