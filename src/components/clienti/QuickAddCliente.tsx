/**
 * QuickAddCliente — mini-modal per aggiungere cliente velocemente.
 * Usato dall'interno del form pratica (solo nome + email + tel).
 * Ref visual: ../evalisdesk-ref/src/components/clienti/QuickAddCliente.jsx
 */
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateCliente } from '@/hooks/useClienti'
import type { Cliente } from '@/types/app.types'

interface QuickAddClienteProps {
  onClienteCreato?: (cliente: Cliente) => void
}

export function QuickAddCliente({ onClienteCreato }: QuickAddClienteProps) {
  const [open, setOpen]   = useState(false)
  const [nome, setNome]   = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel]     = useState('')

  const { mutateAsync, isPending, error } = useCreateCliente()

  const handleCreate = async () => {
    if (!nome.trim()) return
    try {
      const created = await mutateAsync({
        nome: nome.trim(),
        email: email.trim() || null,
        telefono: tel.trim() || null,
      })
      onClienteCreato?.(created)
      setNome('')
      setEmail('')
      setTel('')
      setOpen(false)
    } catch {
      // error viene esposto tramite `error`
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors flex items-center gap-1"
      >
        <Plus className="w-3 h-3" />
        Aggiungi nuovo cliente
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle>Nuovo Cliente (rapido)</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Ragione Sociale / Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Es. Rossi Costruzioni Srl"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                <Input
                  type="email"
                  placeholder="email@azienda.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Telefono</Label>
                <Input
                  placeholder="+39 ..."
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive">{(error as Error).message}</p>
            )}
          </div>

          <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Annulla
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleCreate}
              disabled={isPending || !nome.trim()}
            >
              {isPending ? 'Creazione...' : 'Crea e seleziona'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
