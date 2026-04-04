/**
 * AllegatiSection — sezione allegati nella vista dettaglio pratica.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/AllegatiSection.jsx
 *
 * Funzionalità:
 *   - Lista allegati con icona, nome, dimensione, fase, autore, data
 *   - Download via signed URL (5 min) che apre in nuova scheda
 *   - Delete con conferma (solo admin o chi ha caricato)
 *   - Upload drag-and-drop con barra di avanzamento animata
 */
import { useState, useCallback, useRef } from 'react'
import { FileText, Download, Upload, X, CheckCircle2, Loader2, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileUpload, type FileUploadHandle } from './FileUpload'
import { useAllegatiPratica, useUploadAllegato, useDeleteAllegato } from '@/hooks/useAllegati'
import { downloadAllegato } from '@/lib/storage/allegati'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import type { AllegatoConCaricatoDa } from '@/types/app.types'

// ── Helpers ───────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  try { return format(new Date(d), 'd MMM yyyy', { locale: it }) }
  catch { return d }
}

function isImage(mimeType: string | null | undefined): boolean {
  return !!mimeType?.startsWith('image/')
}

const FASE_LABELS: Record<string, string> = {
  contratto_firmato:       'Contratto',
  programmazione_verifica: 'Verifica',
  richiesta_proforma:      'Proforma',
  elaborazione_pratica:    'Elaborazione',
  firme:                   'Firme',
  completata:              'Completata',
}

// ── Tipi locali per lo stato di upload ───────────────────────────

interface UploadingFile {
  localId: string
  name: string
  size: number
  progress: number
}

// ── Componente ────────────────────────────────────────────────────

interface AllegatiSectionProps {
  praticaId: string
}

export function AllegatiSection({ praticaId }: AllegatiSectionProps) {
  const { userProfile, isAdmin } = useAuth()
  const { data: allegati = [], isLoading } = useAllegatiPratica(praticaId)
  const uploadMutation = useUploadAllegato(praticaId)
  const deleteMutation = useDeleteAllegato(praticaId)
  const fileUploadRef = useRef<FileUploadHandle>(null)

  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ── Upload ──────────────────────────────────────────────────────

  const handleFilesSelected = useCallback((files: File[]) => {
    files.forEach((file) => {
      const localId = crypto.randomUUID()

      // Aggiungi alla lista locale con progress=0
      setUploadingFiles((prev) => [...prev, { localId, name: file.name, size: file.size, progress: 0 }])

      // Anima progress fino a 90% durante upload (come evalisdesk-ref)
      let p = 0
      const interval = setInterval(() => {
        p = Math.min(p + 15, 90)
        setUploadingFiles((prev) =>
          prev.map((f) => (f.localId === localId ? { ...f, progress: p } : f)),
        )
        if (p >= 90) clearInterval(interval)
      }, 200)

      uploadMutation.mutate(
        { file },
        {
          onSuccess: () => {
            clearInterval(interval)
            // Porta a 100% poi rimuovi dopo 600ms
            setUploadingFiles((prev) =>
              prev.map((f) => (f.localId === localId ? { ...f, progress: 100 } : f)),
            )
            setTimeout(() => {
              setUploadingFiles((prev) => prev.filter((f) => f.localId !== localId))
            }, 600)
          },
          onError: () => {
            clearInterval(interval)
            setUploadingFiles((prev) => prev.filter((f) => f.localId !== localId))
          },
        },
      )
    })
  }, [uploadMutation])

  // ── Download ────────────────────────────────────────────────────

  async function handleDownload(allegato: AllegatoConCaricatoDa) {
    if (downloadingId) return
    setDownloadingId(allegato.id)
    try {
      const url = await downloadAllegato(allegato.id)
      const a = document.createElement('a')
      a.href = url
      a.download = allegato.nome_originale
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      toast.error('Impossibile scaricare il file. Riprova.')
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────

  function canDelete(allegato: AllegatoConCaricatoDa): boolean {
    return isAdmin || allegato.caricato_da === userProfile?.id
  }

  function handleDeleteConfirm(allegatoId: string) {
    deleteMutation.mutate(allegatoId, {
      onSettled: () => setDeleteConfirm(null),
    })
  }

  // ── Render ──────────────────────────────────────────────────────

  const isEmpty = !isLoading && allegati.length === 0 && uploadingFiles.length === 0

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header — esatto pattern evalisdesk-ref */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Allegati</h3>
        <div className="flex items-center gap-2">
          {allegati.length > 0 && (
            <span className="text-xs text-muted-foreground">{allegati.length}</span>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => fileUploadRef.current?.triggerPicker()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Carica
          </Button>
        </div>
      </div>

      {/* Drop zone — evalisdesk-ref pattern */}
      <FileUpload
        ref={fileUploadRef}
        onFilesSelected={handleFilesSelected}
        disabled={uploadMutation.isPending}
      />

      {/* Lista allegati + uploading in corso */}
      <div className="p-4 pt-2 space-y-2">
        {/* Loading skeleton */}
        {isLoading && (
          <div className="py-4 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Stato vuoto */}
        {isEmpty && (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nessun allegato caricato
          </p>
        )}

        {/* File in upload (stato locale) */}
        {uploadingFiles.map((f) => (
          <div key={f.localId} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/10">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
              <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${f.progress}%` }}
                />
              </div>
            </div>
            {f.progress >= 100 ? (
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            ) : (
              <span className="text-xs text-muted-foreground shrink-0">{f.progress}%</span>
            )}
          </div>
        ))}

        {/* Allegati reali da DB */}
        {allegati.map((allegato) => {
          const isDownloading = downloadingId === allegato.id
          const isDeleting = deleteMutation.isPending && deleteConfirm === allegato.id
          const showDeleteConfirm = deleteConfirm === allegato.id

          return (
            <div
              key={allegato.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
            >
              {/* Icona tipo file */}
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {isImage(allegato.mime_type) ? (
                  <ImageIcon className="w-4 h-4 text-primary" />
                ) : (
                  <FileText className="w-4 h-4 text-primary" />
                )}
              </div>

              {/* Info file */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {allegato.nome_originale}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(allegato.dimensione_bytes)} · {fmtData(allegato.created_at)}
                  </span>
                  {allegato.caricato_da_profile && (
                    <span className="text-xs text-muted-foreground">
                      · {allegato.caricato_da_profile.nome} {allegato.caricato_da_profile.cognome}
                    </span>
                  )}
                  {allegato.fase_riferimento && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-medium">
                      {FASE_LABELS[allegato.fase_riferimento] ?? allegato.fase_riferimento}
                    </span>
                  )}
                </div>
              </div>

              {/* Azioni — visibili su hover o durante operazioni */}
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="text-xs text-destructive hover:text-destructive/80 font-medium"
                    onClick={() => handleDeleteConfirm(allegato.id)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Elimina'}
                  </button>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground ml-1"
                    onClick={() => setDeleteConfirm(null)}
                    disabled={isDeleting}
                  >
                    Annulla
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-40 p-0.5"
                    onClick={() => handleDownload(allegato)}
                    disabled={isDownloading}
                    title="Scarica"
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  {canDelete(allegato) && (
                    <button
                      className="text-muted-foreground hover:text-destructive p-0.5"
                      onClick={() => setDeleteConfirm(allegato.id)}
                      title="Elimina"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
