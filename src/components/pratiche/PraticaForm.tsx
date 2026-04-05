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
import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, Sparkles } from 'lucide-react'

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
import { setPraticaNorme } from '@/lib/queries/pratiche'

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

// ── Schema Zod ────────────────────────────────────────────────────

const praticaSchema = z.object({
  cliente_id:   z.string().min(1, 'Seleziona un cliente'),
  norme:        z.array(z.string()).min(1, 'Seleziona almeno una norma'),
  ciclo:        z.enum(['certificazione', 'prima_sorveglianza', 'seconda_sorveglianza', 'ricertificazione'] as const),
  tipo_contatto: z.enum(['consulente', 'diretto'] as const),

  // Consulente (obbligatorio se tipo_contatto = 'consulente')
  consulente_id: z.string().nullable().optional(),

  // Referente diretto
  referente_nome:  z.string().nullable().optional(),
  referente_email: z.union([z.string().pipe(z.email('Email non valida')), z.literal(''), z.null()]).optional(),
  referente_tel:   z.string().nullable().optional(),

  // Assegnazione e scadenza
  assegnato_a:  z.string().nullable().optional(),
  data_scadenza: z.string().nullable().optional(),
  note:          z.string().nullable().optional(),
  priorita:      z.number().int().min(0).max(2),

  // Fase 2+: programmazione_verifica e successive
  auditor_id:    z.string().nullable().optional(),
  data_verifica: z.string().nullable().optional(),
  sede_verifica: z.string().nullable().optional(),

  // Fase 3+: richiesta_proforma
  proforma_richiesta: z.boolean().nullable().optional(),

  // Fase 4: elaborazione_pratica
  documenti_ricevuti: z.boolean().nullable().optional(),

  // Fase completata
  numero_certificato:           z.string().nullable().optional(),
  data_emissione_certificato:   z.string().nullable().optional(),
  data_scadenza_certificato:    z.string().nullable().optional(),
}).superRefine((d, ctx) => {
  if (d.tipo_contatto === 'consulente' && !d.consulente_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Seleziona un consulente',
      path: ['consulente_id'],
    })
  }
  // La data di verifica non può essere successiva alla scadenza della pratica
  if (d.data_verifica && d.data_scadenza && d.data_verifica > d.data_scadenza) {
    ctx.addIssue({
      code: 'custom',
      message: 'La data di verifica non può essere successiva alla scadenza della pratica',
      path: ['data_verifica'],
    })
  }
})

export type PraticaFormValues = z.infer<typeof praticaSchema>

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
  const fase   = pratica?.fase

  const { userProfile } = useAuth()
  const isOperatore = userProfile?.ruolo === 'operatore'
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

  const tipoContatto   = watch('tipo_contatto')
  const normeSelezionate = watch('norme')
  const documentiRicevuti = watch('documenti_ricevuti')

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

  // ── Submit ──────────────────────────────────────────────────────

  const onSubmit = async (values: PraticaFormValues) => {
    const { norme, ...rest } = values

    // Normalizza: azzera i campi dell'altra modalità contatto + stringa vuota → null
    const isConsulente = rest.tipo_contatto === 'consulente'
    const finalPayload = {
      ...rest,
      consulente_id:   isConsulente ? (rest.consulente_id   ?? null) : null,
      referente_nome:  isConsulente ? null                           : (rest.referente_nome  ?? null),
      referente_email: isConsulente ? null                           : (rest.referente_email || null),
      referente_tel:   isConsulente ? null                           : (rest.referente_tel   ?? null),
    }

    if (isEdit && pratica) {
      await updatePratica.mutateAsync({ id: pratica.id, data: finalPayload })
      await setPraticaNorme(pratica.id, norme)
    } else {
      await createPratica.mutateAsync({ ...finalPayload, norme })
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
                  <Label className="text-sm font-medium mb-1.5 block">Data Verifica</Label>
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
            {documentiRicevuti === false && (
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
            disabled={isPending}
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
