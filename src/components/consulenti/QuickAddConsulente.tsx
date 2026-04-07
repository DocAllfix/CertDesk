/**
 * QuickAddConsulente — mini-modal per aggiungere consulente velocemente.
 * Usato dall'interno del form pratica (nome + cognome + azienda + email + tel).
 * Speculare a QuickAddCliente. Le norme gestite si impostano dal modal
 * completo in Database → Consulenti.
 */
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateConsulente } from '@/hooks/useConsulenti'
import { sanitizeText } from '@/lib/validation'
import type { Consulente } from '@/types/app.types'

interface QuickAddConsulenteProps {
  onConsulenteCreato?: (consulente: Consulente) => void
}

export function QuickAddConsulente({ onConsulenteCreato }: QuickAddConsulenteProps) {
  const [open, setOpen]       = useState(false)
  const [nome, setNome]       = useState('')
  const [cognome, setCognome] = useState('')
  const [azienda, setAzienda] = useState('')
  const [email, setEmail]     = useState('')
  const [tel, setTel]         = useState('')

  const { mutateAsync, isPending, error } = useCreateConsulente()

  const handleCreate = async () => {
    const nomeSanitized = sanitizeText(nome)
    if (!nomeSanitized) return
    try {
      const created = await mutateAsync({
        nome:     nomeSanitized,
        cognome:  sanitizeText(cognome) || null,
        azienda:  sanitizeText(azienda) || null,
        email:    sanitizeText(email)   || null,
        telefono: sanitizeText(tel)     || null,
      })
      onConsulenteCreato?.(created)
      setNome('')
      setCognome('')
      setAzienda('')
      setEmail('')
      setTel('')
      setOpen(false)
    } catch {
      // error esposto via `error`
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
        Aggiungi nuovo consulente
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-border">
            <DialogTitle>Nuovo Consulente (rapido)</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Marco"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Cognome</Label>
                <Input
                  placeholder="Rossi"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Azienda / Studio</Label>
              <Input
                placeholder="Studio Rossi Consulting"
                value={azienda}
                onChange={(e) => setAzienda(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                <Input
                  type="email"
                  placeholder="marco.rossi@studio.it"
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
            <p className="text-[11px] text-muted-foreground">
              Le norme gestite si impostano dal modal completo in Database → Consulenti.
            </p>
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
