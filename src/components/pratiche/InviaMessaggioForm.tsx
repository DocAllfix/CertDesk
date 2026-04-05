/**
 * InviaMessaggioForm — form di composizione messaggi interni.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/CommunicationFeed.jsx
 * (sezione composer: tipo select + destinatario select + textarea + paperclip + invio)
 *
 * Gestisce opzionalmente un allegato: upload su storage prima dell'invio,
 * poi passa l'allegato_id al messaggio.
 */
import { useState, useRef } from 'react'
import { Send, Paperclip, Tag, X, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button }   from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useSendMessaggio }   from '@/hooks/useMessaggiInterni'
import { getTeamMembers }     from '@/lib/queries/messaggi'
import { uploadAllegato }     from '@/lib/storage/allegati'
import { useAuth }            from '@/hooks/useAuth'
import { sanitizeText }       from '@/lib/validation'
import type { MessaggioTipo } from '@/types/app.types'

// ── Costanti ──────────────────────────────────────────────────────

const DEST_TUTTI  = '__tutti__'
const MAX_MB      = 50
const MAX_BYTES   = MAX_MB * 1024 * 1024

// ── Helpers ───────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function nomeCompleto(
  u: { nome: string | null; cognome: string | null } | null | undefined,
): string {
  if (!u) return '—'
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '—'
}

// ── Props ─────────────────────────────────────────────────────────

interface InviaMessaggioFormProps {
  praticaId: string
}

// ── Componente ────────────────────────────────────────────────────

export function InviaMessaggioForm({ praticaId }: InviaMessaggioFormProps) {
  const { user } = useAuth()

  const [testo,       setTesto]       = useState('')
  const [tipo,        setTipo]        = useState<MessaggioTipo>('commento')
  const [dest,        setDest]        = useState<string>(DEST_TUTTI)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [submitting,  setSubmitting]  = useState(false)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const textareaRef   = useRef<HTMLTextAreaElement>(null)

  // ── Data ────────────────────────────────────────────────────────

  const { data: teamMembers = [] } = useQuery({
    queryKey:  ['team-members'],
    queryFn:   getTeamMembers,
    staleTime: 5 * 60_000,
  })

  const send = useSendMessaggio(praticaId)

  // ── File handler ─────────────────────────────────────────────────

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      toast.error(`Il file supera il limite di ${MAX_MB} MB`)
      return
    }
    setPendingFile(file)
  }

  const handleRemoveFile = () => setPendingFile(null)

  // ── Invio ────────────────────────────────────────────────────────

  const handleSend = async () => {
    const testoTrimmed = sanitizeText(testo)
    if (!testoTrimmed || submitting) return
    if (testoTrimmed.length > 5000) {
      toast.error('Il messaggio supera il limite di 5000 caratteri')
      return
    }

    setSubmitting(true)

    try {
      // 1. Upload allegato opzionale
      let allegatoId: string | null = null
      if (pendingFile) {
        try {
          const result = await uploadAllegato({
            praticaId,
            file:       pendingFile,
            caricatoDa: user?.id ?? null,
          })
          allegatoId = result.id
        } catch (err) {
          toast.error('Errore nel caricamento del file', {
            description: err instanceof Error ? err.message : 'Riprova',
          })
          setSubmitting(false)
          return
        }
      }

      // 2. Invia messaggio
      send.mutate(
        {
          testo:          testoTrimmed,
          tipo,
          destinatarioId: dest !== DEST_TUTTI ? dest : null,
          allegatoId,
        },
        {
          onSuccess: () => {
            setTesto('')
            setDest(DEST_TUTTI)
            setTipo('commento')
            setPendingFile(null)
            textareaRef.current?.focus()
          },
          onSettled: () => setSubmitting(false),
        },
      )
    } catch {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const isLoading = submitting || send.isPending

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Riga 1: tipo + destinatario — speculare a evalisdesk CommunicationFeed.jsx */}
      <div className="flex gap-2">
        <Select value={tipo} onValueChange={(v) => setTipo(v as MessaggioTipo)}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <Tag className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="commento">Commento</SelectItem>
            <SelectItem value="richiesta">Richiesta</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dest} onValueChange={setDest}>
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue placeholder="A chi (opz.)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEST_TUTTI}>Tutti</SelectItem>
            {teamMembers
              .filter((m) => m.id !== user?.id)
              .map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {nomeCompleto(m)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* File selezionato */}
      {pendingFile && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-md border border-border/60 text-xs text-foreground">
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{pendingFile.name}</span>
          <span className="text-muted-foreground shrink-0">{formatBytes(pendingFile.size)}</span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Rimuovi file"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Riga 2: textarea + paperclip + invio */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder="Scrivi un messaggio… (Ctrl+Invio per inviare)"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[72px] bg-muted/30 border-border resize-none pr-10"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="absolute right-3 bottom-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Allega file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
        </div>

        <Button
          size="icon"
          className="bg-primary hover:bg-primary/90 self-end h-10 w-10"
          onClick={handleSend}
          disabled={!testo.trim() || isLoading}
          aria-label="Invia messaggio"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Input file nascosto */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip,.txt"
        onChange={handleFileSelected}
      />
    </div>
  )
}
