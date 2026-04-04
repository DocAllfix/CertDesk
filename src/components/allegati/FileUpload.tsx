/**
 * FileUpload — area drag-and-drop per il caricamento di file.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/AllegatiSection.jsx
 *
 * Validazione client:
 *   - Max 50 MB per file
 *   - Tipi ammessi: PDF, Word, Excel, PowerPoint, immagini, ZIP, testo
 */
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

// ── Costanti ──────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
])

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp', '.zip', '.txt']

// ── Helpers ───────────────────────────────────────────────────────

function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) {
    return `"${file.name}" supera il limite di 50 MB`
  }

  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const validExt = ALLOWED_EXTENSIONS.includes(ext)
  const validMime = file.type === '' || ALLOWED_MIME_TYPES.has(file.type)

  if (!validExt || !validMime) {
    return `"${file.name}" — tipo file non supportato`
  }

  return null
}

// ── Tipi ─────────────────────────────────────────────────────────

export interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  accept?: string
}

// ── Componente ────────────────────────────────────────────────────

export function FileUpload({ onFilesSelected, disabled = false }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  function processFiles(rawFiles: FileList | null) {
    if (!rawFiles || rawFiles.length === 0) return
    const errs: string[] = []
    const valid: File[] = []
    Array.from(rawFiles).forEach((f) => {
      const err = validateFile(f)
      if (err) errs.push(err)
      else valid.push(f)
    })
    setErrors(errs)
    if (valid.length > 0) onFilesSelected(valid)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    processFiles(e.dataTransfer.files)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(e.target.files)
    // Reset input so lo stesso file può essere ricaricato
    e.target.value = ''
  }

  return (
    <div>
      {/* Drop zone — esatto design evalisdesk-ref */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`mx-4 mt-3 mb-1 border-2 border-dashed rounded-lg py-4 text-center transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-border/30'
            : dragging
            ? 'border-primary bg-primary/5 cursor-pointer'
            : 'border-border/50 hover:border-primary/40 hover:bg-muted/20 cursor-pointer'
        }`}
      >
        <Upload className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Trascina file qui o clicca per caricare</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          PDF, Word, Excel, immagini, ZIP — max 50 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleInput}
        disabled={disabled}
      />

      {/* Errori validazione */}
      {errors.length > 0 && (
        <div className="mx-4 mt-2 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
