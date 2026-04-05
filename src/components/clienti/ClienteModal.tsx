/**
 * ClienteModal — creazione e modifica cliente.
 * Ref visual: ../evalisdesk-ref/src/pages/Clienti.jsx → NewClientDialog
 *
 * Props:
 *   open        — visibilità modal
 *   onClose     — chiudi modal
 *   cliente     — se presente → modalità edit, altrimenti → create
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateCliente, useUpdateCliente, useDeleteCliente } from '@/hooks/useClienti'
import { clienteSchema, type ClienteFormValues, sanitizeTextOrNull } from '@/lib/validation'
import type { Cliente } from '@/types/app.types'
import type { InsertCliente, UpdateCliente } from '@/lib/queries/clienti'

// Schema Zod importato da @/lib/validation (clienteSchema)
// numero_dipendenti è trattato come stringa nel form e convertito
// in onSubmit per evitare problemi con z.preprocess e i tipi resolver.

type ClienteFormData = ClienteFormValues

// Helper: converte stringa vuota/undefined/null in null + sanitizza
function str(v: string | null | undefined): string | null {
  return sanitizeTextOrNull(v)
}

// ── Props ─────────────────────────────────────────────────────────

interface ClienteModalProps {
  open: boolean
  onClose: () => void
  cliente?: Cliente | null
}

// ── Component ─────────────────────────────────────────────────────

export function ClienteModal({ open, onClose, cliente }: ClienteModalProps) {
  const isEdit = !!cliente
  const [settoreOpen,  setSettoreOpen]  = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { mutateAsync: create,  isPending: isCreating, error: createError } = useCreateCliente()
  const { mutateAsync: update,  isPending: isUpdating, error: updateError } = useUpdateCliente()
  const { mutateAsync: archive, isPending: isArchiving }                    = useDeleteCliente()

  const isPending  = isCreating || isUpdating || isArchiving
  const serverError = (createError ?? updateError) as Error | null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
  })

  // Popola il form ogni volta che il modal si apre
  useEffect(() => {
    if (!open) return
    if (cliente) {
      reset({
        nome:              cliente.nome,
        ragione_sociale:   cliente.ragione_sociale  ?? '',
        piva:              cliente.piva              ?? '',
        codice_fiscale:    cliente.codice_fiscale    ?? '',
        email:             cliente.email             ?? '',
        pec:               cliente.pec               ?? '',
        telefono:          cliente.telefono          ?? '',
        indirizzo:         cliente.indirizzo         ?? '',
        citta:             cliente.citta             ?? '',
        cap:               cliente.cap               ?? '',
        codice_ea:         cliente.codice_ea         ?? '',
        codice_nace:       cliente.codice_nace       ?? '',
        numero_dipendenti: cliente.numero_dipendenti?.toString() ?? '',
        note:              cliente.note              ?? '',
      })
      if (cliente.codice_ea || cliente.codice_nace || cliente.numero_dipendenti) {
        setSettoreOpen(true)
      }
    } else {
      reset({})
      setSettoreOpen(false)
    }
    setDeleteConfirm(false)
  }, [open, cliente, reset])

  const onSubmit = async (data: ClienteFormData) => {
    // Converti numero_dipendenti da stringa a number | null
    const numDip = data.numero_dipendenti?.trim()
      ? parseInt(data.numero_dipendenti, 10)
      : null
    const validNumDip = numDip !== null && !Number.isNaN(numDip) ? numDip : null

    try {
      if (isEdit && cliente) {
        const payload: UpdateCliente = {
          nome:              data.nome,
          ragione_sociale:   str(data.ragione_sociale),
          piva:              str(data.piva),
          codice_fiscale:    str(data.codice_fiscale),
          email:             str(data.email),
          pec:               str(data.pec),
          telefono:          str(data.telefono),
          indirizzo:         str(data.indirizzo),
          citta:             str(data.citta),
          cap:               str(data.cap),
          codice_ea:         str(data.codice_ea),
          codice_nace:       str(data.codice_nace),
          numero_dipendenti: validNumDip,
          note:              str(data.note),
        }
        await update({ id: cliente.id, data: payload })
      } else {
        const payload: InsertCliente = {
          nome:              data.nome,
          ragione_sociale:   str(data.ragione_sociale),
          piva:              str(data.piva),
          codice_fiscale:    str(data.codice_fiscale),
          email:             str(data.email),
          pec:               str(data.pec),
          telefono:          str(data.telefono),
          indirizzo:         str(data.indirizzo),
          citta:             str(data.citta),
          cap:               str(data.cap),
          codice_ea:         str(data.codice_ea),
          codice_nace:       str(data.codice_nace),
          numero_dipendenti: validNumDip,
          note:              str(data.note),
        }
        await create(payload)
      }
      onClose()
    } catch {
      // errore esposto via serverError
    }
  }

  const handleArchive = async () => {
    if (!cliente) return
    try {
      await archive(cliente.id)
      onClose()
    } catch {
      // errore catturato dalla mutation
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>{isEdit ? 'Modifica Cliente' : 'Nuovo Cliente'}</DialogTitle>
        </DialogHeader>

        {/* Body scrollabile */}
        <form
          id="cliente-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
        >

          {/* ── Dati Anagrafici ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
              Dati Anagrafici
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  Ragione Sociale / Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Es. Rossi Costruzioni Srl"
                  {...register('nome')}
                  aria-invalid={!!errors.nome}
                />
                {errors.nome && (
                  <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">P.IVA</Label>
                  <Input placeholder="IT00000000000" {...register('piva')} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Codice Fiscale</Label>
                  <Input placeholder="RSSMRA80A01H501T" {...register('codice_fiscale')} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Contatti ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
              Contatti
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                  <Input type="email" placeholder="email@azienda.it" {...register('email')} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">PEC</Label>
                  <Input type="email" placeholder="pec@azienda.it" {...register('pec')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Telefono</Label>
                  <Input placeholder="+39 ..." {...register('telefono')} />
                </div>
                <div />
              </div>
            </div>
          </div>

          {/* ── Sede ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
              Sede
            </p>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Indirizzo</Label>
                <Input placeholder="Via Roma 1" {...register('indirizzo')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Città</Label>
                  <Input placeholder="Milano" {...register('citta')} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">CAP</Label>
                  <Input placeholder="20100" {...register('cap')} />
                </div>
                <div />
              </div>
            </div>
          </div>

          {/* ── Dati Settore — collapsible ── */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSettoreOpen((v) => !v)}
            >
              {settoreOpen
                ? <ChevronDown  className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />
              }
              Dati settore certificazione
            </button>
            {settoreOpen && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Codice EA</Label>
                    <Input placeholder="EA29" {...register('codice_ea')} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-1.5 block">Codice NACE/ATECO</Label>
                    <Input placeholder="41.20" {...register('codice_nace')} />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Numero Dipendenti</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Es. 50"
                    {...register('numero_dipendenti')}
                  />
                </div>
                <p className="text-xs text-muted-foreground/70 italic">
                  Questi dati influenzano la durata degli audit ISO
                </p>
              </div>
            )}
          </div>

          {/* ── Note ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
              Note
            </p>
            <Textarea
              rows={2}
              className="resize-none"
              placeholder="Note aggiuntive..."
              {...register('note')}
            />
          </div>

          {/* Errore server */}
          {serverError && (
            <p className="text-xs text-destructive">{serverError.message}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">

          {/* Archivia — solo in edit mode */}
          {isEdit ? (
            <div>
              {deleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confermi archiviazione?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleArchive}
                    disabled={isPending}
                  >
                    Archivia
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteConfirm(true)}
                  disabled={isPending}
                >
                  Archivia cliente
                </Button>
              )}
            </div>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Annulla
            </Button>
            <Button
              type="submit"
              form="cliente-form"
              className="bg-primary hover:bg-primary/90"
              disabled={isPending}
            >
              {isPending
                ? (isEdit ? 'Salvataggio...' : 'Creazione...')
                : (isEdit ? 'Salva modifiche' : 'Crea Cliente')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
