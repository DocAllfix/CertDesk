/**
 * ConsulenteModal — creazione e modifica consulente con norme gestite.
 * Ref visual: ../evalisdesk-ref/src/pages/Consulenti.jsx → ConsulenteModal
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NormeMultiSelect } from '@/components/shared/NormeMultiSelect'
import {
  useCreateConsulente,
  useUpdateConsulente,
  useDeleteConsulente,
  useConsulentiNorme,
  useSetConsulentiNorme,
} from '@/hooks/useConsulenti'
import { consulenteSchema, type ConsulenteFormValues, sanitizeTextOrNull } from '@/lib/validation'
import type { Consulente } from '@/types/app.types'
import type { InsertConsulente, UpdateConsulente } from '@/lib/queries/consulenti'

// Schema Zod importato da @/lib/validation (consulenteSchema)

type ConsulenteFormData = ConsulenteFormValues

function str(v: string | null | undefined): string | null {
  return sanitizeTextOrNull(v)
}

// ── Props ─────────────────────────────────────────────────────────

interface ConsulenteModalProps {
  open: boolean
  onClose: () => void
  consulente?: Consulente | null
}

// ── Component ─────────────────────────────────────────────────────

export function ConsulenteModal({ open, onClose, consulente }: ConsulenteModalProps) {
  const isEdit = !!consulente
  const [norme, setNorme]                 = useState<string[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [archiveNota,  setArchiveNota]    = useState('')
  const [archiveError, setArchiveError]   = useState<string | null>(null)

  const { mutateAsync: create,   isPending: isCreating, error: createError } = useCreateConsulente()
  const { mutateAsync: update,   isPending: isUpdating, error: updateError } = useUpdateConsulente()
  const { mutateAsync: archive,  isPending: isArchiving }                    = useDeleteConsulente()
  const { mutateAsync: setNormeDB, isPending: isSavingNorme }                = useSetConsulentiNorme()
  const { data: normeCaricate }                                              = useConsulentiNorme(consulente?.id)

  const isPending   = isCreating || isUpdating || isArchiving || isSavingNorme
  const serverError = (createError ?? updateError) as Error | null

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ConsulenteFormData>({
    resolver: zodResolver(consulenteSchema),
  })

  // Popola form e norme ad ogni apertura
  useEffect(() => {
    if (!open) return
    if (consulente) {
      reset({
        nome:     consulente.nome,
        cognome:  consulente.cognome  ?? '',
        azienda:  consulente.azienda  ?? '',
        email:    consulente.email    ?? '',
        telefono: consulente.telefono ?? '',
        note:     consulente.note     ?? '',
      })
    } else {
      reset({})
      setNorme([])
    }
    setDeleteConfirm(false)
    setArchiveNota('')
    setArchiveError(null)
  }, [open, consulente, reset])

  // Carica norme esistenti quando arrivano da Supabase
  useEffect(() => {
    if (normeCaricate) setNorme(normeCaricate)
  }, [normeCaricate])

  const onSubmit = async (data: ConsulenteFormData) => {
    try {
      if (isEdit && consulente) {
        const payload: UpdateConsulente = {
          nome:     data.nome,
          cognome:  str(data.cognome),
          azienda:  str(data.azienda),
          email:    str(data.email),
          telefono: str(data.telefono),
          note:     str(data.note),
        }
        await update({ id: consulente.id, data: payload })
        await setNormeDB({ consulenteId: consulente.id, norme })
      } else {
        const payload: InsertConsulente = {
          nome:     data.nome,
          cognome:  str(data.cognome),
          azienda:  str(data.azienda),
          email:    str(data.email),
          telefono: str(data.telefono),
          note:     str(data.note),
        }
        const created = await create(payload)
        await setNormeDB({ consulenteId: created.id, norme })
      }
      onClose()
    } catch {
      // errore esposto via serverError
    }
  }

  const handleArchive = async () => {
    if (!consulente) return
    const nota = archiveNota.trim()
    if (nota.length < 3) {
      setArchiveError('Inserisci una nota di almeno 3 caratteri')
      return
    }
    setArchiveError(null)
    try {
      await archive({ id: consulente.id, nota })
      onClose()
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Errore imprevisto')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>{isEdit ? 'Modifica Consulente' : 'Nuovo Consulente'}</DialogTitle>
        </DialogHeader>

        {/* Body scrollabile */}
        <form
          id="consulente-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
        >

          {/* ── Anagrafica ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
              Anagrafica
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">
                    Nome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Marco"
                    {...register('nome')}
                    aria-invalid={!!errors.nome}
                  />
                  {errors.nome && (
                    <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Cognome</Label>
                  <Input placeholder="Rossi" {...register('cognome')} />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Azienda / Studio</Label>
                <Input placeholder="Studio Rossi Consulting" {...register('azienda')} />
              </div>
            </div>
          </div>

          {/* ── Contatti ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
              Contatti
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                <Input type="email" placeholder="marco.rossi@studio.it" {...register('email')} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Telefono</Label>
                <Input placeholder="+39 ..." {...register('telefono')} />
              </div>
            </div>
          </div>

          {/* ── Norme gestite ── */}
          <div>
            <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Norme gestite
              </p>
              <span title="Le norme per cui questo consulente segue i clienti">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </span>
            </div>
            <NormeMultiSelect value={norme} onChange={setNorme} />
          </div>

          {/* ── Note ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
              Note
            </p>
            <Textarea
              rows={2}
              className="resize-none"
              placeholder="Note..."
              {...register('note')}
            />
          </div>

          {serverError && (
            <p className="text-xs text-destructive">{serverError.message}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">

          {isEdit ? (
            <div className="flex-1 mr-3">
              {deleteConfirm ? (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Motivo archiviazione <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    rows={2}
                    className="resize-none text-xs"
                    placeholder="Es. Cessata collaborazione, pensionamento..."
                    value={archiveNota}
                    onChange={(e) => setArchiveNota(e.target.value)}
                  />
                  {archiveError && (
                    <p className="text-xs text-destructive">{archiveError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="destructive" size="sm" onClick={handleArchive} disabled={isPending}>
                      Conferma archiviazione
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDeleteConfirm(false); setArchiveNota(''); setArchiveError(null) }}
                    >
                      Annulla
                    </Button>
                  </div>
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
                  Archivia consulente
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
              form="consulente-form"
              className="bg-primary hover:bg-primary/90"
              disabled={isPending}
            >
              {isPending
                ? (isEdit ? 'Salvataggio...' : 'Creazione...')
                : (isEdit ? 'Salva Consulente' : 'Nuovo Consulente')
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
