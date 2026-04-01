/**
 * NormeMultiSelect — selezione multipla delle 17 norme ISO.
 * Ref visual: ../evalisdesk-ref/src/components/shared/NormeMultiSelect.jsx
 * Riutilizzabile in ConsulenteModal e PraticaForm.
 */
import { useState } from 'react'
import { Search, X, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'

const ALL_NORME = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'SA 8000', 'PAS 24000',
  'PDR 125/2022', 'ESG-EASI', 'ISO 37001', 'ISO 39001', 'ISO 50001',
  'ISO 27001', 'ISO 14064-1', 'ISO 30415', 'ISO 13009', 'ISO 20121',
  'EN 1090', 'ISO 3834',
]

interface NormeMultiSelectProps {
  value: string[]
  onChange: (norme: string[]) => void
}

export function NormeMultiSelect({ value, onChange }: NormeMultiSelectProps) {
  const [search, setSearch] = useState('')

  const filtered = ALL_NORME.filter(
    (n) => n.toLowerCase().includes(search.toLowerCase()) && !value.includes(n)
  )

  const toggle = (n: string) => {
    if (value.includes(n)) onChange(value.filter((v) => v !== n))
    else onChange([...value, n])
  }

  const isIntegrated = value.length > 1

  return (
    <div className="space-y-2">
      {/* Tag selezionati */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((n) => (
            <span
              key={n}
              className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-medium border border-primary/20"
            >
              {n}
              <button
                type="button"
                onClick={() => toggle(n)}
                className="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Banner Audit Integrato */}
      {isIntegrated && (
        <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/30 rounded-lg px-3 py-2.5 text-xs text-secondary font-semibold">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          ✦ Audit Integrato: {value.join(' + ')}
        </div>
      )}

      {/* Ricerca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="pl-8 text-sm h-8"
          placeholder="Cerca norma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Opzioni disponibili */}
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        {filtered.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => toggle(n)}
            className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
          >
            {n}
          </button>
        ))}
        {filtered.length === 0 && search && (
          <p className="text-xs text-muted-foreground/60 italic py-1">Nessuna norma trovata</p>
        )}
      </div>
    </div>
  )
}
