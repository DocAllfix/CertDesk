/**
 * ImportPraticaForm — form dedicato all'import di pratiche preesistenti.
 *
 * Separato da PraticaForm per evitare condizionali fragili.
 * Riusa tutti gli hook e building block esistenti.
 *
 * Logica chiave:
 *   - Fase completata → data_scadenza calcolata da completata_at + 365/1095gg
 *   - Fase non completata → data_scadenza inserita manualmente dall'utente
 *   - Warning se scadenza calcolata o inserita è nel passato
 *   - Flag prerequisiti auto-settati in base alla fase scelta
 *
 * Design ref: ../evalisdesk-ref/src/components/dettaglio/PraticaModal.jsx
 */
import { useEffect, useState, useRef, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Info } from 'lucide-react'

import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { NormeMultiSelect } from '@/components/shared/NormeMultiSelect'
import { QuickAddCliente }    from '@/components/clienti/QuickAddCliente'
import { QuickAddConsulente } from '@/components/consulenti/QuickAddConsulente'

import { useClienti }     from '@/hooks/useClienti'
import { useConsulenti }  from '@/hooks/useConsulenti'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { useCreatePratica } from '@/hooks/usePratiche'
import { getResponsabilePerNorma, getOperatoriPerNorme, getUtentiConNorme } from '@/lib/queries/userProfiles'
import { checkNumeroPraticaExists } from '@/lib/queries/pratiche'
import { importPraticaSchema, type ImportPraticaFormValues, sanitizeTextOrNull } from '@/lib/validation'

import type { FaseType, CicloType } from '@/types/app.types'

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
  terza_sorveglianza:    'Terza Sorveglianza',
  quarta_sorveglianza:   'Quarta Sorveglianza',
  follow_up_review:      'Follow-up Review',
  ricertificazione:      'Ricertificazione',
  ricertificazione_30m:  'Ricertificazione 30 mesi',
}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/50">
      {children}
    </p>
  )
}

/** Calcola scadenza sorveglianza: completata_at + 365gg (o 1095 per SA 8000). */
function calcolaScadenzaSorveglianza(completataAt: string, norme: string[]): string {
  const hasSA8000 = norme.includes('SA 8000')
  const giorni = hasSA8000 ? 1095 : 365
  const base = new Date(completataAt)
  base.setDate(base.getDate() + giorni)
  return base.toISOString().split('T')[0]
}

function formatDataIT(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// ── Props ─────────────────────────────────────────────────────────

interface ImportPraticaFormProps {
  onSuccess: () => void
  onCancel:  () => void
}

// ── Componente principale ─────────────────────────────────────────

export function ImportPraticaForm({ onSuccess, onCancel }: ImportPraticaFormProps) {
  const { data: clienti    = [] } = useClienti()
  const { data: consulenti = [] } = useConsulenti()
  const { data: team       = [] } = useTeamMembers()

  const createPratica = useCreatePratica()
  const isPending     = createPratica.isPending
  const mutationError = createPratica.error as Error | null

  // ── Form ───────────────────────────────────────────────────────

  const defaultValues: ImportPraticaFormValues = {
    cliente_id:    '',
    norme:         [],
    ciclo:         'certificazione',
    tipo_contatto: 'consulente',
    consulente_id: null,
    referente_nome:  null,
    referente_email: null,
    referente_tel:   null,
    assegnato_a:   null,
    note:          null,
    priorita:      0,
    auditor_id:    null,
    data_verifica: null,
    sede_verifica: null,
    numero_certificato:         null,
    data_emissione_certificato: null,
    import_fase:           'contratto_firmato',
    import_numero_pratica: undefined,
    import_created_at:     undefined,
    import_completata_at:  undefined,
    data_scadenza:         undefined,
  }

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ImportPraticaFormValues>({
    resolver: zodResolver(importPraticaSchema),
    defaultValues,
  })

  const tipoContatto     = watch('tipo_contatto')
  const normeSelezionate = watch('norme')
  const importFase       = watch('import_fase') as FaseType
  const importCompletataAt = watch('import_completata_at')

  const faseIdx = FASI_ORDINATE.indexOf(importFase)
  const isCompletata = importFase === 'completata'

  // ── Check duplicato numero_pratica (debounced) ──────────────────
  const importNumeroPratica = watch('import_numero_pratica')
  const [numeroPraticaDuplicato, setNumeroPraticaDuplicato] = useState(false)
  const [checkingNumero, setCheckingNumero] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!importNumeroPratica?.trim()) {
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
  }, [importNumeroPratica])

  // ── Scadenza sorveglianza calcolata (per fase completata) ───────
  const scadenzaCalcolata = useMemo(() => {
    if (!isCompletata || !importCompletataAt || (normeSelezionate ?? []).length === 0) return null
    return calcolaScadenzaSorveglianza(importCompletataAt, normeSelezionate ?? [])
  }, [isCompletata, importCompletataAt, normeSelezionate])

  const oggi = new Date().toISOString().split('T')[0]
  const scadenzaPassata = scadenzaCalcolata ? scadenzaCalcolata < oggi : false

  // Warning per data_scadenza manuale nel passato (fasi non completate)
  const dataScadenzaManuale = watch('data_scadenza')
  const scadenzaManualePassata = !isCompletata && dataScadenzaManuale ? dataScadenzaManuale < oggi : false

  // ── Auto-fill assegnato_a ───────────────────────────────────────
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

  // ── Filtro utenti per norme nel dropdown "Assegnato a" ──────────
  const [utentiConNormeIds, setUtentiConNormeIds] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    getUtentiConNorme().then((ids) => {
      if (!cancelled) setUtentiConNormeIds(ids)
    })
    return () => { cancelled = true }
  }, [])

  const [operatoriIdsPerNorme, setOperatoriIdsPerNorme] = useState<string[]>([])
  useEffect(() => {
    const norme = normeSelezionate ?? []
    if (norme.length === 0) { setOperatoriIdsPerNorme([]); return }
    let cancelled = false
    getOperatoriPerNorme(norme).then((ids) => {
      if (cancelled) return
      setOperatoriIdsPerNorme(ids)
    })
    return () => { cancelled = true }
  }, [normeSelezionate])

  const normeScelte = (normeSelezionate ?? []).length > 0
  const teamFiltrato = normeScelte
    ? team.filter((u) => {
        if (u.ruolo === 'admin') return false
        if (u.ruolo === 'responsabile') return utentiConNormeIds.includes(u.id)
        return operatoriIdsPerNorme.includes(u.id)
      })
    : []

  // Reset assegnato se non più valido
  const assegnatoCorrente = watch('assegnato_a')
  useEffect(() => {
    if (!normeScelte || !assegnatoCorrente) return
    const ancoraValido = teamFiltrato.some((u) => u.id === assegnatoCorrente)
    if (!ancoraValido) {
      setValue('assegnato_a', null, { shouldDirty: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatoriIdsPerNorme])

  // ── Submit ──────────────────────────────────────────────────────

  const onSubmit = async (values: ImportPraticaFormValues) => {
    const {
      norme,
      import_fase, import_numero_pratica, import_created_at, import_completata_at,
      data_scadenza: dataScadenzaInput,
      ...rest
    } = values

    const isConsulente = rest.tipo_contatto === 'consulente'
    const basePayload = {
      ...rest,
      consulente_id:   isConsulente ? (rest.consulente_id   ?? null) : null,
      referente_nome:  isConsulente ? null                           : sanitizeTextOrNull(rest.referente_nome),
      referente_email: isConsulente ? null                           : (rest.referente_email || null),
      referente_tel:   isConsulente ? null                           : (rest.referente_tel   ?? null),
      note:            sanitizeTextOrNull(rest.note),
      sede_verifica:   sanitizeTextOrNull(rest.sede_verifica),
      numero_certificato: sanitizeTextOrNull(rest.numero_certificato),
    }

    const faseImportIdx = FASI_ORDINATE.indexOf(import_fase)

    if (isCompletata) {
      // Fase completata: calcola data_scadenza da completata_at + 365/1095
      const completataAtValue = import_completata_at!
      const hasSA8000 = norme.includes('SA 8000')
      const giorni = hasSA8000 ? 1095 : 365
      const baseDate = new Date(completataAtValue)
      baseDate.setDate(baseDate.getDate() + giorni)
      const dataScadenzaCalc = baseDate.toISOString().split('T')[0]

      await createPratica.mutateAsync({
        ...basePayload,
        fase:             'completata',
        completata:       true,
        completata_at:    completataAtValue + 'T00:00:00.000Z',
        data_scadenza:    dataScadenzaCalc,
        sorveglianza_reminder_creato: true,
        proforma_richiesta: true,
        proforma_emessa:    true,
        documenti_ricevuti: true,
        numero_pratica:  import_numero_pratica || undefined,
        created_at:      import_created_at || undefined,
        norme,
      })
    } else {
      // Fase non completata: data_scadenza dall'utente
      await createPratica.mutateAsync({
        ...basePayload,
        fase:             import_fase,
        data_scadenza:    dataScadenzaInput!,
        proforma_richiesta: faseImportIdx >= 3 ? true : null,
        proforma_emessa:    faseImportIdx >= 3 ? true : undefined,
        documenti_ricevuti: faseImportIdx >= 4 ? true : null,
        numero_pratica:  import_numero_pratica || undefined,
        created_at:      import_created_at || undefined,
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

        {/* ── FASE ATTUALE ─────────────────────────────────────── */}
        <div>
          <SectionLabel>Fase attuale della pratica</SectionLabel>
          <Controller
            control={control}
            name="import_fase"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
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

          {/* Riepilogo flag auto-settati */}
          {faseIdx >= 3 && (
            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Flag auto-impostati per coerenza:
              </p>
              {faseIdx >= 3 && <p>Proforma richiesta ed emessa</p>}
              {faseIdx >= 4 && <p>Documenti ricevuti</p>}
              {isCompletata && <p>Pratica completata</p>}
            </div>
          )}
        </div>

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
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="cursor-pointer">
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
            <div className="mt-2">
              <QuickAddCliente
                onClienteCreato={(c) => setValue('cliente_id', c.id, { shouldValidate: true })}
              />
            </div>
          </div>
        </div>

        {/* ── NORME & CICLO ───────────────────────────────────── */}
        <div>
          <SectionLabel>Norme & Ciclo</SectionLabel>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Norme <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="norme"
                render={({ field }) => (
                  <NormeMultiSelect value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.norme && (
                <p className="text-xs text-destructive mt-1">{errors.norme.message}</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Ciclo</Label>
              <Controller
                control={control}
                name="ciclo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(CICLO_LABELS) as [CicloType, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

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
                  onClick={() => field.onChange('consulente')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                    field.value === 'consulente'
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  Tramite Consulente
                </button>
                <button
                  type="button"
                  onClick={() => field.onChange('diretto')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
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
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v === '__none__' ? null : v || null)}>
                    <SelectTrigger className="cursor-pointer">
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
              <div className="mt-2">
                <QuickAddConsulente
                  onConsulenteCreato={(c) =>
                    setValue('consulente_id', c.id, { shouldValidate: true, shouldDirty: true })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Nome Referente</Label>
                <Input placeholder="Mario Rossi" {...register('referente_nome')} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                <Input type="email" placeholder="email@..." {...register('referente_email')} />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Telefono</Label>
                <Input placeholder="+39 ..." {...register('referente_tel')} />
              </div>
            </div>
          )}
        </div>

        {/* ── ASSEGNAZIONE & PRIORITÀ ─────────────────────────── */}
        <div>
          <SectionLabel>Assegnazione</SectionLabel>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Assegnato a</Label>
              <Controller
                control={control}
                name="assegnato_a"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : v || null)}
                    disabled={!normeScelte}
                  >
                    <SelectTrigger className={normeScelte ? 'cursor-pointer' : 'opacity-60'}>
                      <SelectValue placeholder={normeScelte ? 'Seleziona operatore...' : 'Seleziona prima le norme'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nessuno —</SelectItem>
                      {teamFiltrato.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome} {u.cognome}
                          {u.ruolo === 'responsabile' ? ' (Resp.)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Priorità</Label>
              <Controller
                control={control}
                name="priorita"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Normale</SelectItem>
                      <SelectItem value="1">Alta</SelectItem>
                      <SelectItem value="2">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* ── DATI IMPORTAZIONE ────────────────────────────────── */}
        <div>
          <SectionLabel>Dati Importazione</SectionLabel>
          <div className="space-y-3">
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
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Data inizio pratica</Label>
              <Input type="date" {...register('import_created_at')} />
              <p className="text-xs text-muted-foreground mt-1">
                La data originale in cui la pratica è stata avviata
              </p>
            </div>
          </div>
        </div>

        {/* ── VERIFICA (se fase ≥ programmazione_verifica) ──────── */}
        {faseGte(importFase, 'programmazione_verifica') && (
          <div>
            <SectionLabel>Verifica</SectionLabel>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">
                    Data Verifica
                    {faseGte(importFase, 'richiesta_proforma') && <span className="text-destructive"> *</span>}
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

        {/* ── BRANCH COMPLETATA: data completamento + certificato ── */}
        {isCompletata && (
          <div>
            <SectionLabel>Completamento</SectionLabel>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">
                  Data completamento <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...register('import_completata_at')} />
                {errors.import_completata_at && (
                  <p className="text-xs text-destructive mt-1">{errors.import_completata_at.message}</p>
                )}
              </div>

              {/* Scadenza sorveglianza calcolata */}
              {scadenzaCalcolata && (
                <div className={`rounded-lg px-3 py-2.5 text-xs ${
                  scadenzaPassata
                    ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                    : 'bg-muted/50 border border-border text-muted-foreground'
                }`}>
                  <p className="font-medium text-foreground flex items-center gap-1.5">
                    {scadenzaPassata && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                    Scadenza sorveglianza calcolata: <strong>{formatDataIT(scadenzaCalcolata)}</strong>
                    {normeSelezionate?.includes('SA 8000') ? ' (SA 8000: ciclo 36 mesi)' : ' (+365 giorni)'}
                  </p>
                  {scadenzaPassata && (
                    <p className="mt-1">
                      Attenzione: la sorveglianza risulta già scaduta. Verrà notificata immediatamente dopo l'inserimento.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Numero certificato</Label>
                  <Input placeholder="Es. CERT-001/25" {...register('numero_certificato')} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Data emissione cert.</Label>
                  <Input type="date" {...register('data_emissione_certificato')} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BRANCH NON COMPLETATA: data scadenza manuale ─────── */}
        {!isCompletata && (
          <div>
            <SectionLabel>Scadenza</SectionLabel>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Data scadenza pratica <span className="text-destructive">*</span>
              </Label>
              <Input type="date" {...register('data_scadenza')} />
              {errors.data_scadenza && (
                <p className="text-xs text-destructive mt-1">{errors.data_scadenza.message}</p>
              )}
              {scadenzaManualePassata && (
                <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  La data di scadenza è nel passato. Le notifiche di escalation partiranno immediatamente.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NOTE ─────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Note</SectionLabel>
          <Textarea
            rows={2}
            className="resize-none"
            placeholder="Note sulla pratica importata..."
            {...register('note')}
          />
        </div>

        {/* Errore server */}
        {mutationError && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-xs text-destructive font-medium">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {mutationError.message}
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2 shrink-0">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Annulla
        </Button>
        <Button
          type="submit"
          className="bg-primary hover:bg-primary/90"
          disabled={isPending || numeroPraticaDuplicato}
        >
          {isPending ? 'Importazione...' : 'Importa Pratica'}
        </Button>
      </div>

    </form>
  )
}
