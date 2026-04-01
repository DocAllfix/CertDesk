/**
 * PraticaModal — wrapper Dialog per PraticaForm.
 * Gestisce apertura/chiusura e titolo dinamico (crea vs modifica).
 *
 * Uso:
 *   <PraticaModal open={open} onClose={() => setOpen(false)} />
 *   <PraticaModal open={open} onClose={...} pratica={praticaEsistente} />
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/PraticaModal.jsx
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PraticaForm } from './PraticaForm'
import type { PraticaConRelazioni } from '@/types/app.types'

interface PraticaModalProps {
  open:     boolean
  onClose:  () => void
  pratica?: PraticaConRelazioni
}

export function PraticaModal({ open, onClose, pratica }: PraticaModalProps) {
  const isEdit = !!pratica
  const title  = isEdit
    ? `Modifica Pratica ${pratica.numero_pratica ?? ''}`
    : 'Nuova Pratica'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <PraticaForm
          pratica={pratica}
          onSuccess={onClose}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
