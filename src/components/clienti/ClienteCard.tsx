/**
 * ClienteCard — card compatta per lista clienti.
 * Ref visual: ../evalisdesk-ref/src/pages/Clienti.jsx → ClientCard
 */
import { Building2, Mail, Phone, MapPin, FolderKanban, Pencil } from 'lucide-react'
import type { Cliente } from '@/types/app.types'

interface ClienteCardProps {
  cliente: Cliente
  pratiche_attive?: number
  onClick?: () => void
}

export function ClienteCard({ cliente, pratiche_attive = 0, onClick }: ClienteCardProps) {
  const indirizzo = [cliente.indirizzo, cliente.citta, cliente.cap]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all duration-200 group cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {cliente.nome}
            </h3>
            {cliente.ragione_sociale && (
              <p className="text-xs text-muted-foreground">{cliente.ragione_sociale}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Badge pratiche attive */}
          <div className="flex items-center gap-1.5 bg-primary/5 px-2.5 py-1 rounded-full">
            <FolderKanban className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium text-primary">{pratiche_attive}</span>
          </div>
          {/* Edit button — visibile solo su hover */}
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); onClick?.() }}
            title="Modifica"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Contatti */}
      <div className="space-y-2">
        {cliente.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{cliente.email}</span>
          </div>
        )}
        {cliente.telefono && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{cliente.telefono}</span>
          </div>
        )}
        {indirizzo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{indirizzo}</span>
          </div>
        )}
        {!cliente.email && !cliente.telefono && !indirizzo && (
          <p className="text-xs text-muted-foreground/50 italic">Nessun contatto inserito</p>
        )}
      </div>
    </div>
  )
}
