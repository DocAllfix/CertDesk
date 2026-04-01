/**
 * PraticaDettaglioPage — wrapper page per PraticaDettaglio.
 * Legge l'id da useParams, carica la pratica completa con usePratica,
 * gestisce loading ed errore, poi delega il render a PraticaDettaglio.
 */
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { usePratica } from '@/hooks/usePratiche'
import { PraticaDettaglio } from '@/components/pratiche/PraticaDettaglio'

export default function PraticaDettaglioPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = usePratica(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-destructive font-medium">
          {(error as Error | null)?.message ?? 'Pratica non trovata'}
        </p>
      </div>
    )
  }

  return <PraticaDettaglio pratica={data} />
}
