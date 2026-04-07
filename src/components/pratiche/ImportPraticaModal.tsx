/**
 * ImportPraticaModal — wrapper Dialog per ImportPraticaForm.
 * Apre il modal di importazione pratiche preesistenti.
 *
 * Uso:
 *   <ImportPraticaModal open={open} onClose={() => setOpen(false)} />
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/PraticaModal.jsx
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImportPraticaForm } from './ImportPraticaForm'

interface ImportPraticaModalProps {
  open:    boolean
  onClose: () => void
}

export function ImportPraticaModal({ open, onClose }: ImportPraticaModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>Importa Pratica Preesistente</DialogTitle>
        </DialogHeader>

        <ImportPraticaForm
          onSuccess={onClose}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
