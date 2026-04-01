/**
 * AvanzaFaseModal — Modal per avanzamento/retrocessione fase.
 *
 * Convertito da: c:\Users\user\Desktop\evalisdesk-ref\src\components\dettaglio\AvanzaFaseModal.jsx
 *
 * Pattern Evalisdesk mantenuti:
 * - Dialog con DialogContent sm:max-w-md p-0 gap-0
 * - DialogHeader con border-b
 * - Checklist prerequisiti: bg-success/5 border-success/30 quando ✓
 * - Alert rosso se non tutti i prerequisiti sono soddisfatti
 * - Footer: bg-muted/20 flex justify-end gap-2
 *
 * Aggiunte CertDesk:
 * - Prerequisiti REALI dal DB (data_verifica, proforma_emessa, documenti_ricevuti)
 * - Pre-validazione con canAdvanceFase() (UX only, trigger DB è autoritativo)
 * - Campo note (opzionale avanzamento, obbligatorio retrocessione)
 * - Errore DB mostrato in alert rosso
 * - Freccia fase attuale → fase target con colori
 */
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button }    from '@/components/ui/button'
import { Textarea }  from '@/components/ui/textarea'
import { Check, X, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'

import { BadgeFase } from '@/components/shared/BadgeFase'
import {
  canAdvanceFase,
  FASE_INDEX,
  FASE_LABELS,
} from '@/lib/workflow'
import { useAvanzaFase } from '@/hooks/usePratiche'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { useAuth }        from '@/hooks/useAuth'

import type { PraticaConRelazioni, FaseType } from '@/types/app.types'

// ── Prerequisiti per fase target ─────────────────────────────────

interface Prerequisito {
  id: string
  label: string
  soddisfatto: boolean
}

function getPrerequisiti(
  pratica: PraticaConRelazioni,
  targetFase: FaseType
): Prerequisito[] {
  switch (targetFase) {
    case 'programmazione_verifica':
      return [
        { id: 'none', label: 'Nessun prerequisito richiesto', soddisfatto: true },
      ]
    case 'richiesta_proforma':
      return [
        {
          id: 'data_verifica',
          label: pratica.data_verifica
            ? `Data verifica impostata: ${new Date(pratica.data_verifica).toLocaleDateString('it-IT')}`
            : 'Imposta data verifica prima di procedere',
          soddisfatto: !!pratica.data_verifica,
        },
      ]
    case 'elaborazione_pratica':
      return [
        {
          id: 'proforma_emessa',
          label: pratica.proforma_emessa
            ? 'Proforma emessa'
            : 'Proforma non ancora emessa',
          soddisfatto: !!pratica.proforma_emessa,
        },
      ]
    case 'firme':
      return [
        {
          id: 'documenti_ricevuti',
          label: pratica.documenti_ricevuti
            ? 'Documenti ricevuti'
            : 'Documenti mancanti — in attesa di ricezione',
          soddisfatto: !!pratica.documenti_ricevuti,
        },
      ]
    case 'completata':
      return [
        { id: 'none', label: 'Nessun prerequisito aggiuntivo', soddisfatto: true },
      ]
    default:
      return []
  }
}

// ── Props ─────────────────────────────────────────────────────────

interface AvanzaFaseModalProps {
  open: boolean
  onClose: () => void
  pratica: PraticaConRelazioni
  targetFase: FaseType
}

// ── Componente ────────────────────────────────────────────────────

export function AvanzaFaseModal({ open, onClose, pratica, targetFase }: AvanzaFaseModalProps) {
  const { user } = useAuth()
  const { data: team = [] } = useTeamMembers()
  const avanzaFase = useAvanzaFase()

  const [motivo, setMotivo] = useState('')
  const [dbError, setDbError] = useState<string | null>(null)

  const isRetrocessione = FASE_INDEX[targetFase] < FASE_INDEX[pratica.fase]
  const prerequisiti = isRetrocessione ? [] : getPrerequisiti(pratica, targetFase)
  const preValidazione = canAdvanceFase(pratica, targetFase)

  // Per retrocessione il motivo è obbligatorio
  const motivoOk = isRetrocessione ? motivo.trim().length > 0 : true
  const canProceed = preValidazione.canAdvance && motivoOk && !avanzaFase.isPending

  function handleConfirm() {
    if (!user) return
    setDbError(null)

    avanzaFase.mutate(
      {
        id: pratica.id,
        oldFase: pratica.fase,
        nuovaFase: targetFase,
        userId: user.id,
        allUsers: team.map(t => ({ id: t.id, ruolo: t.ruolo })),
        motivo: motivo.trim() || undefined,
      },
      {
        onSuccess: () => {
          setMotivo('')
          onClose()
        },
        onError: (err) => {
          // Mostra il messaggio del trigger DB (già in italiano)
          setDbError((err as Error).message)
        },
      }
    )
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setMotivo('')
      setDbError(null)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        {/* Header — Evalisdesk pattern */}
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-base font-poppins">
            {isRetrocessione ? 'Retrocedi fase' : 'Avanza fase'}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Transizione visiva: fase attuale → fase target */}
          <div className="flex items-center gap-2 justify-center">
            <BadgeFase fase={pratica.fase} short />
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <BadgeFase fase={targetFase} short />
          </div>

          {/* Checklist prerequisiti — pattern Evalisdesk */}
          {prerequisiti.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {isRetrocessione
                  ? 'Conferma la retrocessione:'
                  : 'Prerequisiti per avanzare:'}
              </p>
              <div className="space-y-2">
                {prerequisiti.map(p => (
                  <div
                    key={p.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                      p.soddisfatto
                        ? 'bg-success/5 border-success/30 text-success'
                        : 'bg-destructive/5 border-destructive/20 text-destructive'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      p.soddisfatto ? 'bg-success border-success' : 'bg-destructive/20 border-destructive/40'
                    }`}>
                      {p.soddisfatto
                        ? <Check className="w-3 h-3 text-white" />
                        : <X className="w-3 h-3 text-destructive" />}
                    </div>
                    <span className="text-sm font-medium">{p.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Warning se prerequisiti mancanti */}
          {!preValidazione.canAdvance && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              <X className="w-3.5 h-3.5 shrink-0" />
              {preValidazione.missingPrereqs.join('. ')}
            </div>
          )}

          {/* Campo note/motivo */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              {isRetrocessione ? 'Motivo retrocessione *' : 'Note (opzionale)'}
            </label>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder={isRetrocessione
                ? 'Indica il motivo della retrocessione...'
                : 'Aggiungi note per il cambio fase...'
              }
              className="resize-none h-20 text-sm"
            />
          </div>

          {/* Errore dal DB (trigger rifiuta) */}
          {dbError && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Errore dal database</p>
                <p className="text-xs mt-0.5 opacity-80">{dbError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Evalisdesk pattern: bg-muted/20, border-t */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={avanzaFase.isPending}>
            Annulla
          </Button>
          <Button
            disabled={!canProceed}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
            onClick={handleConfirm}
          >
            {avanzaFase.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isRetrocessione ? 'Conferma retrocessione' : `Avanza a ${FASE_LABELS[targetFase]}`}
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
