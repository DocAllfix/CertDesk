/**
 * ConsulentiPage — lista consulenti con card avatar e norme.
 * Ref visual: ../evalisdesk-ref/src/pages/Consulenti.jsx
 */
import { useState } from 'react'
import { Plus, Mail, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useConsulenti } from '@/hooks/useConsulenti'
import { ConsulenteModal } from '@/components/consulenti/ConsulenteModal'
import type { Consulente } from '@/types/app.types'

// ── Helper: iniziali dal nome/cognome ────────────────────────────

function getInitials(nome: string, cognome: string | null): string {
  return [nome[0], cognome?.[0]].filter(Boolean).join('').toUpperCase()
}

// ── ConsulenteCard ───────────────────────────────────────────────

// Tipo che include le norme embedded dal JOIN in getConsulenti
type ConsulenteConNorme = Consulente & { consulenti_norme: { norma_codice: string }[] }

interface ConsulenteCardProps {
  consulente: ConsulenteConNorme
  onClick: () => void
}

function ConsulenteCard({ consulente, onClick }: ConsulenteCardProps) {
  const norme    = (consulente.consulenti_norme ?? []).map((r) => r.norma_codice)
  const initials = getInitials(consulente.nome, consulente.cognome)
  const visibili  = norme.slice(0, 3)
  const extra     = norme.length - visibili.length

  return (
    <div
      className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-all duration-200 group text-center cursor-pointer"
      onClick={onClick}
    >
      {/* Avatar con iniziali */}
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
        <span className="text-lg font-semibold text-primary">{initials}</span>
      </div>

      {/* Nome */}
      <h3 className="text-sm font-semibold text-foreground">
        {consulente.nome} {consulente.cognome ?? ''}
      </h3>

      {/* Azienda */}
      {consulente.azienda && (
        <p className="text-xs text-muted-foreground mt-0.5">{consulente.azienda}</p>
      )}

      {/* Norme tags */}
      {norme.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-3">
          {visibili.map((n) => (
            <span key={n} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {n}
            </span>
          ))}
          {extra > 0 && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              +{extra} altri
            </span>
          )}
        </div>
      )}

      {/* Contatti */}
      <div className="mt-4 pt-4 border-t border-border space-y-2">
        {consulente.email && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{consulente.email}</span>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>{norme.length} {norme.length === 1 ? 'norma' : 'norme'} gestite</span>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────

export default function ConsulentiPage() {
  const [modalOpen, setModalOpen]               = useState(false)
  const [selectedConsulente, setSelected]       = useState<Consulente | null>(null)

  const { data: consulenti, isLoading, error }  = useConsulenti()

  const openCreate = () => { setSelected(null); setModalOpen(true) }
  const openEdit   = (c: Consulente) => { setSelected(c); setModalOpen(true) }
  const handleClose = () => { setModalOpen(false); setSelected(null) }

  return (
    <TooltipProvider>
      <div className="space-y-5 max-w-[1400px]">

        {/* Toolbar */}
        <div className="flex justify-end">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi Consulente
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 h-[220px] animate-pulse" />
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
        {!isLoading && !error && consulenti && consulenti.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(consulenti as ConsulenteConNorme[]).map((c) => (
              <ConsulenteCard key={c.id} consulente={c} onClick={() => openEdit(c)} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && consulenti && consulenti.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Nessun consulente presente</p>
          </div>
        )}

        {/* Modal */}
        <ConsulenteModal
          open={modalOpen}
          onClose={handleClose}
          consulente={selectedConsulente}
        />
      </div>
    </TooltipProvider>
  )
}
