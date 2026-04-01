/**
 * ClientiPage — lista clienti con ricerca, grid card, modal CRUD.
 * Ref visual: ../evalisdesk-ref/src/pages/Clienti.jsx
 */
import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useClienti } from '@/hooks/useClienti'
import { useAuth } from '@/hooks/useAuth'
import { ClienteCard } from '@/components/clienti/ClienteCard'
import { ClienteModal } from '@/components/clienti/ClienteModal'
import type { Cliente } from '@/types/app.types'

export default function ClientiPage() {
  const [search, setSearch]               = useState('')
  const [modalOpen, setModalOpen]         = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  const { isResponsabile } = useAuth()
  const { data: clienti, isLoading, error } = useClienti(search)

  const handleOpenCreate = () => {
    setSelectedCliente(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (cliente: Cliente) => {
    // Operatori possono aprire il modal solo in lettura (nessun pulsante modifica visibile)
    // Il DB protegge comunque via RLS, ma evitiamo UX confusa
    if (!isResponsabile) return
    setSelectedCliente(cliente)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setSelectedCliente(null)
  }

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        {isResponsabile && (
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            onClick={handleOpenCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Cliente
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border p-5 h-[156px] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Errore */}
      {error && !isLoading && (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        </div>
      )}

      {/* Grid card */}
      {!isLoading && !error && clienti && clienti.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clienti.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              onClick={() => handleOpenEdit(c)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && clienti && clienti.length === 0 && (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <p className="text-sm text-muted-foreground">Nessun cliente trovato</p>
          {search && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Prova a modificare i termini di ricerca
            </p>
          )}
        </div>
      )}

      {/* Modal crea / modifica */}
      <ClienteModal
        open={modalOpen}
        onClose={handleClose}
        cliente={selectedCliente}
      />
    </div>
  )
}
