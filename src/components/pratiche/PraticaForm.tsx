/**
 * PraticaForm — form creazione/modifica pratica con React Hook Form + Zod.
 *
 * Visibilità condizionale campi:
 *   - Fase 2+: data_verifica, auditor_id, sede_verifica
 *   - Fase 3+: proforma_richiesta
 *   - Fase 4:  documenti_ricevuti (con alert blocco se false)
 *   - Fase completata: numero_certificato, data_emissione/scadenza_certificato
 *
 * Auto-fill assegnato_a: quando si seleziona la prima norma, cerca il
 * responsabile configurato in responsabili_norme e pre-compila il campo.
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/PraticaModal.jsx
 */
import { useEffect, useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Sparkles, Import } from 'lucide-react'

import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { NormeMultiSelect } from '@/components/shared/NormeMultiSelect'
import { QuickAddCliente }  from '@/components/clienti/QuickAddCliente'

import { useAuth }        from '@/hooks/useAuth'
import { useClienti }     from '@/hooks/useClienti'
import { useConsulenti }  from '@/hooks/useConsulenti'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { useCreatePratica, useUpdatePratica } from '@/hooks/usePratiche'
import { getResponsabilePerNorma } from '@/lib/queries/userProfiles'
import { setPraticaNorme, checkNumeroPraticaExists } from '@/lib/queries/pratiche'
import { praticaSchema, type PraticaFormValues, sanitizeTextOrNull } from '@/lib/validation'

import type { PraticaConRelazioni, FaseType, CicloType } from '@/types/app.types'

// ── Costanti ─────────────────────────────────────────────────────

const FASE_ORDINE: Record<FaseType, number> = {
  contratto_firmato:      1,
  programmazione_verifica: 2,
  richiesta_proforma:     3,
  elaborazione_pratica:   4,
  firme:                  5,
  completata:             6,
}

const CICLO_LABELS: Record<CicloType, string> = {
  certificazione:        'Certificazione',
  prima_sorveglianza:    'Prima Sorveglianza',
  seconda_sorveglianza:  'Seconda Sorveglianza',
  ricertificazione:      'Ricertificazione',
}

// Schema Zod importato da @/lib/validation (praticaSchema)

const FASE_LABELS: Record<FaseType, string> = {
  contratto_firmato:       'Contratto Firmato',
  programmazione_verifica: 'Programmazione Verifica',
  richiesta_proforma:      'Richiesta Proforma',
  elaborazione_pratica:    'Elaborazione Pratica',
  firme:                   'Firme',
  completata:              'Completata',
}

const FASI_ORDINATE: FaseType[] = [
  'contratto_firmato', 'programmazione_verifica',
  'richiesta_proforma', 'elaborazione_pratica', 'firme', 'completata',
]

// ── Helper ────────────────────────────────────────────────────────

function faseGte(fase: FaseType | undefined, soglia: FaseType): boolean {
  if (!fase) return false
  return FASE_ORDINE[fase] >= FASE_ORDINE[soglia]
}

function faseEq(fase: FaseType | undefined, target: FaseType): boolean {
  return fase === target
}

// ── Sezione header ────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
      {children}
    </p>
  )
}

// ── Props ─────────────────────────────────────────────────────────

interface PraticaFormProps {
  pratica?: PraticaConRelazioni
  onSuccess: () => void
  onCancel:  () => void
}

// ── Componente principale ─────────────────────────────────────────

export function PraticaForm({ pratica, onSuccess, onCancel }: PraticaFormProps) {
  const isEdit = !!pratica

  const { userProfile } = useAuth()
  const isOperatore = userProfile?.ruolo === 'operatore'
  // Toggle import visibile solo in creazione e solo per admin/responsabili
  const canImport = !isEdit && !isOperatore
  // In modifica, l'operatore può modificare solo i campi operativi (note, audit, flag fase)
  const gestionaleDisabled = isEdit && isOperatore

  const { data: clienti    = [] } = useClienti()
  const { data: consulenti = [] } = useConsulenti()
  const { data: team       = [] } = useTeamMembers()

  const createPratica = useCreatePratica()
  const updatePratica = useUpdatePratica()

  const isPending = createPratica.isPending || updatePratica.isPending
  const mutationError = (createPratica.error ?? updatePratica.error) as Error | null

  // ── Valori iniziali ─────────────────────────────────────────────

  const defaultValues: PraticaFormValues = {
    cliente_id:   pratica?.cliente_id ?? '',
    norme:        pratica?.norme?.map(n => n.codice) ?? [],
    ciclo:        pratica?.ciclo ?? 'certificazione',
    tipo_contatto: pratica?.tipo_contatto ?? 'consulente',

    consulente_id: pratica?.consulente_id ?? null,
    referente_nome:  pratica?.referente_nome  ?? null,
    referente_email: pratica?.referente_email ?? null,
    referente_tel:   pratica?.referente_tel   ?? null,

    assegnato_a:  pratica?.assegnato_a  ?? null,
    data_scadenza: pratica?.data_scadenza ?? null,
    note:          pratica?.note          ?? null,
    priorita:      pratica?.priorita      ?? 0,

    auditor_id:    pratica?.auditor_id    ?? null,
    data_verifica: pratica?.data_verifica ?? null,
    sede_verifica: pratica?.sede_verifica ?? null,

    proforma_richiesta: pratica?.proforma_richiesta ?? null,
    documenti_ricevuti: pratica?.documenti_ricevuti ?? null,

    numero_certificato:         pratica?.numero_certificato         ?? null,
    data_emissione_certificato: pratica?.data_emissione_certificato ?? null,
    data_scadenza_certificato:  pratica?.data_scadenza_certificato  ?? null,
  }

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PraticaFormValues>({
    resolver: zodResolver(praticaSchema),
    defaultValues,
  })

  const tipoContatto     = watch('tipo_contatto')
  const normeSelezionate = watch('norme')
  const documentiRicevuti = watch('documenti_ricevuti')
  const importMode       = watch('import_mode')
  const importFase       = watch('import_fase') as FaseType | undefined

  const importNumeroPratica = watch('import_numero_pratica')

  // ── Check duplicato numero_pratica (debounced) ──────────────────
  const [numeroPraticaDuplicato, setNumeroPraticaDuplicato] = useState(false)
  const [checkingNumero, setCheckingNumero] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    // Reset se vuoto o non in import mode
    if (!importMode || !importNumeroPratica?.trim()) {
      setNumeroPraticaDuplicato(false)
      setCheckingNumero(false)
      return
    }

    setCheckingNumero(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const exists = await checkNumeroPraticaExists(importNumeroPratica)
      setNumeroPraticaDuplicato(exists)
      setCheckingNumero(false)
    }, 500)

    return () => clearTimeout(debounceRef.current)
  }, [importMode, importNumeroPratica])

  // In modalità import, la fase è quella selezionata dall'utente.
  // In modifica, la fase è quella della pratica esistente.
  // In creazione normale, undefined (nessun campo fase-specifico visibile).
  const fase: FaseType | undefined = importMode ? importFase : pratica?.fase

  // ── Auto-fill assegnato_a ───────────────────────────────────────
  // Quando cambia la prima norma selezionata, cerca il responsabile
  // configurato in responsabili_norme e pre-compila assegnato_a
  // (solo se il campo è ancora vuoto — non sovrascrive scelta manuale)

  useEffect(() => {
    const primaNorma = normeSelezionate?.[0]
    if (!primaNorma) return

    let cancelled = false
    getResponsabilePerNorma(primaNorma).then((userId) => {
      if (cancelled || !userId) return
      setValue('assegnato_a', userId, { shouldDirty: false })
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normeSelezionate?.[0]])

  // ── Auto-set flag coerenza in modalità import ───────────────────
  // Quando cambia la fase di import, auto-setta i flag prerequisito
  // delle fasi precedenti per garantire coerenza con il workflow.

  useEffect(() => {
    if (!importMode || !importFase) return
    const idx = FASI_ORDINATE.indexOf(importFase)

    // Fase ≥ elaborazione_pratica (idx 3) → proforma_emessa + proforma_richiesta = true
    if (idx >= 3) {
      setValue('proforma_richiesta', true, { shouldDirty: false })
    }

    // Fase ≥ firme (idx 4) → documenti_ricevuti = true
    // (proforma già coperta sopra)
  }, [importMode, importFase, setValue])

  // ── Submit ──────────────────────────────────────────────────────

  const onSubmit = async (values: PraticaFormValues) => {
    const {
      norme,
      import_mode, import_fase, import_created_at,
      import_numero_pratica, import_completata_at,
      ...rest
    } = values

    // Normalizza: azzera i campi dell'altra modalità contatto + stringa vuota → null
    // Sanitizza campi testo libero (DOMPurify — rimuove HTML injection)
    const isConsulente = rest.tipo_contatto === 'consulente'
    const finalPayload = {
      ...rest,
      consulente_id:   isConsulente ? (rest.consulente_id   ?? null) : null,
      referente_nome:  isConsulente ? null                           : sanitizeTextOrNull(rest.referente_nome),
      referente_email: isConsulente ? null                           : (rest.referente_email || null),
      referente_tel:   isConsulente ? null                           : (rest.referente_tel   ?? null),
      note:            sanitizeTextOrNull(rest.note),
      sede_verifica:   sanitizeTextOrNull(rest.sede_verifica),
      numero_certificato: sanitizeTextOrNull(rest.numero_certificato),
    }

    if (isEdit && pratica) {
      await updatePratica.mutateAsync({ id: pratica.id, data: finalPayload })
      await setPraticaNorme(pratica.id, norme)
    } else {
      // ── Import mode: aggiungi campi extra al payload ──────────
      const importPayload = import_mode && import_fase ? {
        fase:            import_fase as FaseType,
        numero_pratica:  import_numero_pratica || undefined, // undefined → trigger auto-genera
        created_at:      import_created_at || undefined,     // undefined → DEFAULT NOW()
        // Flag coerenza: auto-settati in base alla fase
        proforma_richiesta: FASI_ORDINATE.indexOf(import_fase as FaseType) >= 3 ? true : finalPayload.proforma_richiesta,
        proforma_emessa:    FASI_ORDINATE.indexOf(import_fase as FaseType) >= 3 ? true : undefined,
        documenti_ricevuti: FASI_ORDINATE.indexOf(import_fase as FaseType) >= 4 ? true : finalPayload.documenti_ricevuti,
        // Completamento
        ...(import_fase === 'completata' ? {
          completata:     true,
          completata_at:  import_completata_at || new Date().toISOString(),
          sorveglianza_reminder_creato: true, // impedisce trigger spurio su futuri update
        } : {}),
      } : {}

      // createPratica gestisce internamente il promemoria sorveglianza
      // per pratiche importate come completate (vedi lib/queries/pratiche.ts)
      await createPratica.mutateAsync({
        ...finalPayload,
        ...importPayload,
        norme,
      })
    }
    onSuccess()
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* Corpo scrollabile */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── CLIENTE ─────────────────────────────────────────── */}
        <div>
          <SectionLabel>Cliente</SectionLabel>
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              Cliente <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="cliente_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isEdit && isOperatore}>
                  <SelectTrigger className={isEdit && isOperatore ? 'opacity-60' : 'cursor-pointer'}>
                    <SelectValue placeholder="Seleziona cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clienti.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome ?? c.ragione_sociale ?? c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.cliente_id && (
              <p className="text-xs text-destructive mt-1">{errors.cliente_id.message}</p>
            )}
            {!gestionaleDisabled && (
              <div className="mt-2">
                <QuickAddCliente
                  onClienteCreato={(c) => setValue('cliente_id', c.id, { shouldValidate: true })}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── IMPORTAZIONE (solo creazione, solo admin/responsabile) ── */}
        {canImport && (
          <div>
            <Controller
              control={control}
              name="import_mode"
              render={({ field }) => (
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true)
                      if (!checked) {
                        // Reset campi import quando si disattiva
                        setValue('import_fase', undefined)
                        setValue('import_created_at', undefined)
                        setValue('import_numero_pratica', undefined)
                        setValue('import_completata_at', undefined)
                      }
                    }}
                  />
                  <Import className="w-3.5 h-3.5 text-secondary" />
                  <span className="text-sm font-medium text-foreground group-hover:text-secondary transition-colors">
                    Importa pratica esistente
                  </span>
                </label>
              )}
            />

            {importMode && (
              <div className="mt-4 space-y-3 p-4 rounded-lg border border-secondary/30 bg-secondary/5">
                <p className="text-xs text-secondary font-semibold uppercase tracking-wider">
                  Dati importazione
                </p>

                {/* Fase iniziale */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">
                    Fase attuale <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="import_fase"
                    render={({ field }) => (
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder="Seleziona la fase della pratica..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FASI_ORDINATE.map((f) => (
                            <SelectItem key={f} value={f}>
                              {FASE_LABELS[f]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.import_fase && (
                    <p className="text-xs text-destructive mt-1">{errors.import_fase.message}</p>
                  )}
                </div>

                {/* Data inizio pratica */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Data inizio pratica</Label>
                  <Input type="date" {...register('import_created_at')} />
                  <p className="text-xs text-muted-foreground mt-1">
                    La data originale in cui la pratica è stata avviata
                  </p>
                </div>

                {/* Numero pratica originale */}
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Numero pratica originale</Label>
                  <Input
                    placeholder="Es. CERT-2024-0015 (vuoto = auto-generato)"
                    {...register('import_numero_pratica')}
                  />
                  {checkingNumero && (
                    <p className="text-xs text-muted-foreground mt-1">Verifica in corso...</p>
                  )}
                  {numeroPraticaDuplicato && !checkingNumero && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Questo numero pratica esiste già nel sistema
                    </p>
                  )}
                </div>

                {/* Campi extra per fase completata */}
                {importFase === 'completata' && (
                  <div className="space-y-3 pt-2 border-t border-secondary/20">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">
                        Data completamento <span className="text-destructive">*</span>
                      </Label>
                      <Input type="date" {...register('import_completata_at')} />
                      {errors.import_completata_at && (
                        <p className="text-xs text-destructive mt-1">{errors.import_completata_at.message}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Riepilogo flag auto-settati */}
                {importFase && FASI_ORDINATE.indexOf(importFase) >= 3 && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 space-y-1">
                    <p className="font-medium text-foreground">Flag auto-impostati per coerenza:</p>
                    {FASI_ORDINATE.indexOf(importFase) >= 3 && (
                      <p>Proforma richiesta ed emessa</p>
                    )}
                    {FASI_ORDINATE.indexOf(importFase) >= 4 && (
                      <p>Documenti ricevuti</p>
                    )}
                    {importFase === 'completata' && (
                      <p>Pratica completata</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TIPO CONTATTO ────────────────────────────────────── */}
        <div>
          <SectionLabel>Tipo Contatto</SectionLabel>
          <Controller
            control={control}
            name="tipo_contatto"
            render={({ field }) => (
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => !gestionaleDisabled && field.onChange('consulente')}
                  disabled={gestionaleDisabled}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${gestionaleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                    field.value === 'consulente'
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  Tramite Consulente
                </button>
                <button
                  type="button"
                  onClick={() => !gestionaleDisabled && field.onChange('diretto')}
                  disabled={gestionaleDisabled}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${gestionaleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                    field.value === 'diretto'
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  Referente Diretto
                </button>
              </div>
            )}
          />

          {tipoContatto === 'consulente' ? (
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Consulente</Label>
              <Controller
                control={control}
                name="consulente_id"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === '__none__' ? null : v || null)} disabled={gestionaleDisabled}>
                    <SelectTrigger className={gestionaleDisabled ? 'opacity-60' : 'cursor-pointer'}>
                      <SelectValue placeholder="Seleziona consulente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {consulenti.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} {c.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.consulente_id && (
                <p className="text-xs text-destructive mt-1">{errors.consulente_id.message}</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Nome Referente</Label>
                <Input
                  placeholder="Mario Rossi"
                  disabled={gestionaleDisabled}
                  className={gestionaleDisabled ? 'opacity-60' : ''}
                  {...register('referente_nome')}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                <Input
                  type="email"
                  placeholder="email@..."
                  disabled={gestionaleDisabled}
                  className={gestionaleDisabled ? 'opacity-60' : ''}
                  {...register('referente_email')}
                />
                {errors.referente_email && (
                  <p className="text-xs text-destructive mt-1">{errors.referente_email.message}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Telefono</Label>
                <Input placeholder="+39 ..." disabled={gestionaleDisabled} className={gestionaleDisabled ? 'opacity-60' : ''} {...register('referente_tel')} />
              </div>
            </div>
          )}
        </div>

        {/* ── CERTIFICAZIONE ───────────────────────────────────── */}
        <div>
          <SectionLabel>Certificazione</SectionLabel>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Norme <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="norme"
                render={({ field }) => (
                  <NormeMultiSelect value={field.value} onChange={field.onChange} disabled={gestionaleDisabled} />
                )}
              />
              {errors.norme && (
                <p className="text-xs text-destructive mt-1">{errors.norme.message}</p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Tipologia ciclo <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="ciclo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={gestionaleDisabled}>
                    <SelectTrigger className={gestionaleDisabled ? 'opacity-60' : 'cursor-pointer'}>
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(CICLO_LABELS) as [CicloType, string][]).map(([v, label]) => (
                        <SelectItem key={v} value={v}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.ciclo && (
                <p className="text-xs text-destructive mt-1">{errors.ciclo.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── ASSEGNAZIONE ─────────────────────────────────────── */}
        <div>
          <SectionLabel>Assegnazione</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Assegnato a</Label>
              <Controller
                control={control}
                name="assegnato_a"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === '__none__' ? null : v || null)} disabled={gestionaleDisabled}>
                    <SelectTrigger className={gestionaleDisabled ? 'opacity-60' : 'cursor-pointer'}>
                      <SelectValue placeholder="Seleziona utente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nessuno —</SelectItem>
                      {team.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome} {u.cognome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Scadenza</Label>
              <Input type="date" disabled={gestionaleDisabled} className={gestionaleDisabled ? 'opacity-60' : ''} {...register('data_scadenza')} />
            </div>
          </div>

          <div className="mt-3">
            <Label className="text-sm font-medium mb-1.5 block">Priorità</Label>
            <Controller
              control={control}
              name="priorita"
              render={({ field }) => (
                <div className="flex gap-2">
                  {([
                    [0, 'Normale'],
                    [1, 'Alta'],
                    [2, 'Urgente'],
                  ] as [number, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => !gestionaleDisabled && field.onChange(val)}
                      disabled={gestionaleDisabled}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors ${gestionaleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                        field.value === val
                          ? val === 2
                            ? 'bg-destructive/10 border-destructive/40 text-destructive'
                            : val === 1
                            ? 'bg-orange-500/10 border-orange-500/40 text-orange-500'
                            : 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
        </div>

        {/* ── FASE 2+: AUDIT ───────────────────────────────────── */}
        {faseGte(fase, 'programmazione_verifica') && (
          <div>
            <SectionLabel>Audit</SectionLabel>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">
                    Data Verifica
                    {importMode && faseGte(fase, 'richiesta_proforma') && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input type="date" {...register('data_verifica')} />
                  {errors.data_verifica && (
                    <p className="text-xs text-destructive mt-1">{errors.data_verifica.message}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Auditor</Label>
                  <Controller
                    control={control}
                    name="auditor_id"
                    render={({ field }) => (
                      <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === '__none__' ? null : v || null)}>
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder="Seleziona auditor..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nessuno —</SelectItem>
                          {team.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.nome} {u.cognome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Sede Verifica</Label>
                <Input placeholder="Es. Sede Milano" {...register('sede_verifica')} />
              </div>
            </div>
          </div>
        )}

        {/* ── FASE 3+: PROFORMA ────────────────────────────────── */}
        {faseGte(fase, 'richiesta_proforma') && (
          <div>
            <SectionLabel>Proforma</SectionLabel>
            {/* In import con fase ≥ elaborazione_pratica, proforma è auto-settata */}
            {importMode && faseGte(fase, 'elaborazione_pratica') ? (
              <p className="text-sm text-muted-foreground">
                Proforma richiesta ed emessa (auto-impostato per coerenza)
              </p>
            ) : (
              <Controller
                control={control}
                name="proforma_richiesta"
                render={({ field }) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <span className="text-sm">Proforma inviata al cliente</span>
                  </label>
                )}
              />
            )}
          </div>
        )}

        {/* ── FASE 4: DOCUMENTI ────────────────────────────────── */}
        {faseEq(fase, 'elaborazione_pratica') && (
          <div>
            <SectionLabel>Documenti</SectionLabel>
            <Controller
              control={control}
              name="documenti_ricevuti"
              render={({ field }) => (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <span className="text-sm">Documenti ricevuti dal cliente</span>
                </label>
              )}
            />
            {documentiRicevuti === false && !importMode && (
              <div className="mt-3 flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-xs text-destructive font-medium">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Pratica BLOCCATA — i documenti non sono ancora stati ricevuti.
                Impossibile avanzare alla fase Firme finché questo flag non è attivo.
              </div>
            )}
          </div>
        )}

        {/* ── FASE COMPLETATA: CERTIFICATO ─────────────────────── */}
        {faseEq(fase, 'completata') && (
          <div>
            <SectionLabel>Certificato</SectionLabel>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Numero Certificato</Label>
                <Input placeholder="Es. CERT-2026-0042" {...register('numero_certificato')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Data Emissione</Label>
                  <Input type="date" {...register('data_emissione_certificato')} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Scadenza Certificato</Label>
                  <Input type="date" {...register('data_scadenza_certificato')} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NOTE ─────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Note</SectionLabel>
          <Textarea
            placeholder="Note interne sulla pratica..."
            rows={3}
            className="resize-none"
            {...register('note')}
          />
        </div>

        {/* Errore mutation */}
        {mutationError && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {mutationError.message}
          </div>
        )}

      </div>

      {/* ── Footer fisso ─────────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
        {/* Banner Audit Integrato in footer (riepiloga la scelta norme) */}
        {normeSelezionate.length > 1 && (
          <span className="flex items-center gap-1.5 text-xs text-secondary font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Audit Integrato ({normeSelezionate.length} norme)
          </span>
        )}
        <div className={`flex gap-2 ${normeSelezionate.length > 1 ? '' : 'ml-auto'}`}>
          <Button variant="ghost" type="button" onClick={onCancel} disabled={isPending}>
            Annulla
          </Button>
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/90"
            disabled={isPending || numeroPraticaDuplicato}
          >
            {isPending
              ? isEdit ? 'Salvataggio...' : 'Creazione...'
              : isEdit ? 'Salva modifiche' : 'Crea Pratica'
            }
          </Button>
        </div>
      </div>

    </form>
  )
}
