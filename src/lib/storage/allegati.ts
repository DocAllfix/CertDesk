/**
 * Storage layer per gli allegati delle pratiche.
 *
 * Bucket Supabase Storage: allegati-pratiche (privato)
 * Path oggetti: {praticaId}/{uuid}-{nome_originale_sanitizzato}
 *
 * Ogni signed URL ha validità 5 minuti (300 secondi).
 * Il DB record viene creato DOPO l'upload fisico; se fallisce, il file viene rimosso.
 */
import { supabase } from '@/lib/supabase'
import type { FaseType } from '@/types/app.types'

const BUCKET = 'allegati-pratiche'
const SIGNED_URL_EXPIRY = 300 // 5 minuti

// ── Tipi ─────────────────────────────────────────────────────────

export interface UploadAllegatoParams {
  praticaId: string
  file: File
  faseRiferimento?: FaseType | null
  descrizione?: string | null
}

export interface AllegatoUploadResult {
  id: string
  storagePath: string
  signedUrl: string
}

// ── Helpers ───────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function buildStoragePath(praticaId: string, originalName: string): string {
  const uuid = crypto.randomUUID()
  const safeName = sanitizeFilename(originalName)
  return `${praticaId}/${uuid}-${safeName}`
}

// ── API pubblica ──────────────────────────────────────────────────

/**
 * Genera un signed URL temporaneo (default: 5 minuti) per un path di storage.
 * Usata da downloadAllegato e da uploadAllegato dopo l'inserimento.
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn = SIGNED_URL_EXPIRY,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data) {
    throw new Error(`Errore nella generazione dell'URL firmato: ${error?.message ?? 'dati mancanti'}`)
  }
  return data.signedUrl
}

/**
 * Carica un file su Storage, crea il record in DB, ritorna id + signed URL (5 min).
 * Se l'INSERT su DB fallisce, rimuove il file dallo storage (rollback).
 */
export async function uploadAllegato(params: UploadAllegatoParams): Promise<AllegatoUploadResult> {
  const { praticaId, file, faseRiferimento, descrizione } = params
  const storagePath = buildStoragePath(praticaId, file.name)

  // 1. Upload fisico
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false })

  if (uploadError) {
    throw new Error(`Errore nel caricamento del file: ${uploadError.message}`)
  }

  // 2. Record DB
  const { data: allegato, error: dbError } = await supabase
    .from('allegati')
    .insert({
      pratica_id: praticaId,
      nome_file: storagePath.split('/').pop() ?? file.name,
      nome_originale: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      dimensione_bytes: file.size,
      fase_riferimento: faseRiferimento ?? null,
      descrizione: descrizione ?? null,
    })
    .select('id, storage_path')
    .single()

  if (dbError || !allegato) {
    // Rollback: rimuovi il file appena caricato
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error(
      `Errore nel salvataggio del record allegato: ${dbError?.message ?? 'nessun dato restituito'}`,
    )
  }

  // 3. Signed URL per apertura immediata
  const signedUrl = await getSignedUrl(allegato.storage_path)

  return { id: allegato.id, storagePath: allegato.storage_path, signedUrl }
}

/**
 * Genera un signed URL (5 min) per scaricare un allegato tramite il suo ID DB.
 * Richiede che l'utente abbia accesso all'allegato (RLS su tabella allegati).
 */
export async function downloadAllegato(allegatoId: string): Promise<string> {
  const { data: allegato, error } = await supabase
    .from('allegati')
    .select('storage_path')
    .eq('id', allegatoId)
    .single()

  if (error || !allegato) {
    throw new Error(`Allegato non trovato: ${error?.message ?? 'ID non valido'}`)
  }

  return getSignedUrl(allegato.storage_path)
}

/**
 * Elimina un allegato da Storage e dalla tabella DB.
 * La RLS garantisce che solo admin o chi ha caricato il file possa eliminarlo.
 */
export async function deleteAllegato(allegatoId: string): Promise<void> {
  // Recupera storage_path prima di eliminare il record
  const { data: allegato, error: fetchError } = await supabase
    .from('allegati')
    .select('storage_path')
    .eq('id', allegatoId)
    .single()

  if (fetchError || !allegato) {
    throw new Error(`Allegato non trovato: ${fetchError?.message ?? 'ID non valido'}`)
  }

  // Elimina da Storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([allegato.storage_path])

  if (storageError) {
    throw new Error(`Errore nella rimozione del file da storage: ${storageError.message}`)
  }

  // Elimina da DB
  const { error: dbError } = await supabase
    .from('allegati')
    .delete()
    .eq('id', allegatoId)

  if (dbError) {
    throw new Error(`Errore nell'eliminazione del record allegato: ${dbError.message}`)
  }
}
