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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button }    from '@/components/ui/button'
import { Textarea }  from '@/components/ui/textarea'
import { Check, X, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { BadgeFase } from '@/components/shared/BadgeFase'
import {
  canAdvanceFase,
  FASE_INDEX,
  FASE_LABELS,
} from '@/lib/workflow'
import { useAvanzaFase, praticheKeys } from '@/hooks/usePratiche'
import { updatePratica }  from '@/lib/queries/pratiche'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { useAuth }        from '@/hooks/useAuth'

import { sanitizeText } from '@/lib/validation'
import type { PraticaConRelazioni, FaseType } from '@/types/app.types'

// ── Prerequisiti per fase target ─────────────────────────────────

/**
 * editType: se il prerequisito non è soddisfatto, il modal mostra
 * un'azione inline per completarlo senza uscire.
 * - 'date'   → input type="date" + bottone Salva  (data_verifica)
 * - 'toggle' → bottone "Segna come ✓"             (booleani)
 */
interface Prerequisito {
  id:          string
  label:       string
  soddisfatto: boolean
  editType?:   'date' | 'toggle'
  fieldName?:  'data_verifica' | 'proforma_emessa' | 'documenti_ricevuti' | 'firme_inviate'
  actionLabel?: string
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
          id:          'data_verifica',
          label:       pratica.data_verifica
            ? `Data verifica: ${new Date(pratica.data_verifica).toLocaleDateString('it-IT')}`
            : 'Data verifica non ancora impostata',
          soddisfatto: !!pratica.data_verifica,
          editType:    'date',
          fieldName:   'data_verifica',
        },
      ]
    case 'elaborazione_pratica':
      return [
        {
          id:          'proforma_emessa',
          label:       pratica.proforma_emessa
            ? 'Proforma emessa'
            : 'Proforma non ancora emessa',
          soddisfatto: !!pratica.proforma_emessa,
          editType:    'toggle',
          fieldName:   'proforma_emessa',
          actionLabel: 'Segna come emessa',
        },
      ]
    case 'firme':
      return [
        {
          id:          'documenti_ricevuti',
          label:       pratica.documenti_ricevuti
            ? 'Documenti ricevuti'
            : 'Documenti mancanti — in attesa di ricezione',
          soddisfatto: !!pratica.documenti_ricevuti,
          editType:    'toggle',
          fieldName:   'documenti_ricevuti',
          actionLabel: 'Segna come ricevuti',
        },
      ]
    case 'invio_firme':
      return [
        { id: 'none', label: 'Nessun prerequisito richiesto', soddisfatto: true },
      ]
    case 'completata':
      return [
        {
          id:          'firme_inviate',
          label:       pratica.firme_inviate
            ? 'Firme inviate'
            : 'Firme non ancora inviate',
          soddisfatto: !!pratica.firme_inviate,
          editType:    'toggle',
          fieldName:   'firme_inviate',
          actionLabel: 'Segna come inviate',
        },
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
  const qc = useQueryClient()

  const [motivo,    setMotivo]    = useState('')
  const [dbError,   setDbError]   = useState<string | null>(null)
  const [dateValue, setDateValue] = useState('')
  const dateInvalid = !!(dateValue && pratica.data_scadenza && dateValue > pratica.data_scadenza)

  // ── Mutation inline per prerequisiti ─────────────────────────
  // Usa updatePratica diretto + invalidateQueries(detail) — NON useUpdatePratica
  // per evitare il setQueryData con flat row che causerebbe crash in PraticaDettaglio.
  const inlineSave = useMutation({
    mutationFn: (update: { data_verifica?: string; proforma_emessa?: boolean; documenti_ricevuti?: boolean; firme_inviate?: boolean }) =>
      updatePratica(pratica.id, update),
    onSuccess: () => {
      // Refetch del dettaglio: la pratica prop si aggiornerà automaticamente
      // e il prerequisito passerà a soddisfatto nel prossimo render.
      qc.invalidateQueries({ queryKey: praticheKeys.detail(pratica.id) })
    },
    onError: (err) => {
      toast.error((err as Error).message)
    },
  })

  const isRetrocessione = FASE_INDEX[targetFase] < FASE_INDEX[pratica.fase]
  const prerequisiti = isRetrocessione ? [] : getPrerequisiti(pratica, targetFase)
  const preValidazione = canAdvanceFase(pratica, targetFase)

  // Per retrocessione il motivo è obbligatorio
  const motivoClean = sanitizeText(motivo)
  const motivoOk = isRetrocessione ? motivoClean.length > 0 : true
  const motivoTooLong = motivoClean.length > 2000
  const canProceed = preValidazione.canAdvance && motivoOk && !motivoTooLong && !avanzaFase.isPending && !inlineSave.isPending

  function handleConfirm() {
    if (!user) return
    setDbError(null)

    avanzaFase.mutate(
      {
        id: pratica.id,
        oldFase: pratica.fase,
        nuovaFase: targetFase,
        userId: user.id,
        allUsers: team.map(t => ({ id: t.id, ruolo: t.ruolo, nome: t.nome, cognome: t.cognome })),
        clienteNome: pratica.cliente?.nome ?? pratica.cliente?.ragione_sociale ?? undefined,
        motivo: motivoClean || undefined,
        audit: pratica.audit ?? undefined,
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
      setDateValue('')
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
          <DialogDescription className="sr-only">
            {isRetrocessione
              ? 'Conferma la retrocessione della pratica alla fase precedente'
              : 'Conferma l\'avanzamento della pratica alla fase successiva'}
          </DialogDescription>
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
                    className={`w-full flex flex-col gap-2 px-4 py-3 rounded-lg border transition-all ${
                      p.soddisfatto
                        ? 'bg-success/5 border-success/30 text-success'
                        : 'bg-destructive/5 border-destructive/20 text-destructive'
                    }`}
                  >
                    {/* Riga icona + label */}
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                        p.soddisfatto ? 'bg-success border-success' : 'bg-destructive/20 border-destructive/40'
                      }`}>
                        {p.soddisfatto
                          ? <Check className="w-3 h-3 text-white" />
                          : <X className="w-3 h-3 text-destructive" />}
                      </div>
                      <span className="text-sm font-medium">{p.label}</span>
                      {/* Toggle inline (proforma_emessa / documenti_ricevuti) */}
                      {!p.soddisfatto && p.editType === 'toggle' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-7 px-2.5 text-xs text-primary border border-primary/30 hover:bg-primary/10 shrink-0"
                          disabled={inlineSave.isPending}
                          onClick={() => inlineSave.mutate({ [p.fieldName!]: true } as Parameters<typeof inlineSave.mutate>[0])}
                        >
                          {inlineSave.isPending
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : p.actionLabel ?? 'Segna ✓'}
                        </Button>
                      )}
                    </div>
                    {/* Input data inline (data_verifica) */}
                    {!p.soddisfatto && p.editType === 'date' && (
                      <div className="flex flex-col gap-1.5 pl-8">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateValue}
                            onChange={e => setDateValue(e.target.value)}
                            className="h-7 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs text-primary border border-primary/30 hover:bg-primary/10"
                            disabled={!dateValue || dateInvalid || inlineSave.isPending}
                            onClick={() => inlineSave.mutate({ data_verifica: dateValue })}
                          >
                            {inlineSave.isPending
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : 'Salva'}
                          </Button>
                        </div>
                        {dateInvalid && (
                          <p className="text-xs text-destructive">
                            La data di verifica non può essere successiva alla scadenza della pratica
                          </p>
                        )}
                      </div>
                    )}
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
            {motivoTooLong && (
              <p className="text-xs text-destructive mt-1">Massimo 2000 caratteri</p>
            )}
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
