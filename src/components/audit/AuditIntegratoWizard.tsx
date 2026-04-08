/**
 * AuditIntegratoWizard — wizard per creare un audit integrato con N pratiche.
 *
 * 3 step:
 *   1. Dati comuni: cliente (+QuickAdd), ciclo, contatto (consulente/diretto
 *      con QuickAdd o referente diretto), norme (≥2, no SA 8000)
 *   2. Per ogni norma: operatore assegnato (filtrato per norma) + data scadenza
 *      Auto-fill operatore via responsabili_norme (come PraticaForm)
 *   3. Riepilogo + conferma
 *
 * Logica di filtro/auto-assign identica a PraticaForm:
 *   - Admin escluso dal dropdown
 *   - Responsabili visibili se hanno almeno 1 norma in responsabili_norme
 *   - Operatori visibili solo se competenti sulla norma della riga
 *   - Auto-fill: getResponsabilePerNorma(norma) → primo user assegnato a quella norma
 *
 * Tema: secondary (viola) in tutto il wizard.
 */
import { useState, useEffect } from 'react'
import { Sparkles, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { NormeMultiSelect } from '@/components/shared/NormeMultiSelect'
import { QuickAddCliente } from '@/components/clienti/QuickAddCliente'
import { QuickAddConsulente } from '@/components/consulenti/QuickAddConsulente'

import { useClienti } from '@/hooks/useClienti'
import { useConsulenti } from '@/hooks/useConsulenti'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { useCreateAuditIntegrato } from '@/hooks/useAuditIntegrati'
import {
  getOperatoriPerNorme,
  getResponsabilePerNorma,
  getUtentiConNorme,
} from '@/lib/queries/userProfiles'

import type { CicloType, ContattoType, CreaAuditPraticaInput } from '@/types/app.types'

interface AuditIntegratoWizardProps {
  open: boolean
  onClose: () => void
  /** Pre-fill dal PraticaForm se l'utente stava compilando */
  prefill?: {
    cliente_id?: string
    ciclo?: CicloType
    norme?: string[]
    tipo_contatto?: ContattoType
    consulente_id?: string | null
  }
}

const CICLI: { value: CicloType; label: string }[] = [
  { value: 'certificazione',        label: 'Certificazione' },
  { value: 'prima_sorveglianza',    label: 'Prima Sorveglianza' },
  { value: 'seconda_sorveglianza',  label: 'Seconda Sorveglianza' },
  { value: 'ricertificazione',      label: 'Ricertificazione' },
]

export function AuditIntegratoWizard({ open, onClose, prefill }: AuditIntegratoWizardProps) {
  const [step, setStep] = useState(0)

  // ── Step 1 — dati comuni ──────────────────────────────────────
  const [clienteId, setClienteId]       = useState(prefill?.cliente_id ?? '')
  const [ciclo, setCiclo]               = useState<CicloType>(prefill?.ciclo ?? 'certificazione')
  const [norme, setNorme]               = useState<string[]>(prefill?.norme?.filter(n => n !== 'SA 8000') ?? [])
  const [tipoContatto, setTipoContatto] = useState<ContattoType>(prefill?.tipo_contatto ?? 'consulente')
  const [consulenteId, setConsulenteId] = useState(prefill?.consulente_id ?? '')
  const [referenteNome, setReferenteNome]   = useState('')
  const [referenteEmail, setReferenteEmail] = useState('')
  const [referenteTel, setReferenteTel]     = useState('')
  const [note, setNote]                 = useState('')

  // ── Step 2 — per-pratica ──────────────────────────────────────
  const [praticheData, setPraticheData] = useState<CreaAuditPraticaInput[]>([])

  // ── Auto-assign data ──────────────────────────────────────────
  // Mappa norma → user_ids competenti (da responsabili_norme)
  const [operatoriPerNorma, setOperatoriPerNorma] = useState<Record<string, string[]>>({})
  // Lista user_ids che hanno almeno 1 norma (per filtro responsabili)
  const [utentiConNormeIds, setUtentiConNormeIds] = useState<string[]>([])

  const { data: clienti = [] }    = useClienti()
  const { data: consulenti = [] } = useConsulenti()
  const { data: team = [] }       = useTeamMembers()
  const createAudit = useCreateAuditIntegrato()

  // ── Sync praticheData quando norme cambiano ──────────────────
  // Preserva entries esistenti per norme invariate, crea nuovi per norme aggiunte.
  const syncPratiche = (newNorme: string[]) => {
    setNorme(newNorme)
    setPraticheData(prev => newNorme.map(norma => {
      const existing = prev.find(p => p.norma_codice === norma)
      return existing ?? { norma_codice: norma, assegnato_a: null, data_scadenza: null }
    }))
  }

  const updatePratica = (idx: number, field: keyof CreaAuditPraticaInput, value: string | null) => {
    setPraticheData(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value || null } : p))
  }

  // ── Fetch operatori + auto-fill quando si entra in step 2 ────
  useEffect(() => {
    if (step !== 1 || norme.length === 0) return

    let cancelled = false

    async function fetchOperatoriData() {
      // 1. Utenti con almeno 1 norma (per filtro responsabili)
      const utentiIds = await getUtentiConNorme()
      if (cancelled) return
      setUtentiConNormeIds(utentiIds)

      // 2. Per ogni norma: lista operatori + responsabile di default
      const opMap: Record<string, string[]> = {}
      const autoFills: Record<string, string | null> = {}

      await Promise.all(
        norme.map(async (norma) => {
          const [ops, resp] = await Promise.all([
            getOperatoriPerNorme([norma]),
            getResponsabilePerNorma(norma),
          ])
          opMap[norma] = ops
          autoFills[norma] = resp
        })
      )

      if (cancelled) return
      setOperatoriPerNorma(opMap)

      // 3. Auto-fill assegnato_a (solo se ancora null — non sovrascrive scelta manuale)
      setPraticheData(prev => prev.map(p => {
        if (p.assegnato_a) return p
        const autoFill = autoFills[p.norma_codice]
        return autoFill ? { ...p, assegnato_a: autoFill } : p
      }))
    }

    fetchOperatoriData()
    return () => { cancelled = true }
  // norme è state array, cambia solo quando syncPratiche viene chiamata
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, norme])

  // ── Filtro team per riga (per norma) ─────────────────────────
  // Stessa logica di PraticaForm:
  //   - Admin escluso
  //   - Responsabile visibile se ha almeno 1 norma in responsabili_norme
  //   - Operatore visibile solo se competente sulla norma della riga
  const getFilteredTeam = (norma: string) => {
    const opsIds = operatoriPerNorma[norma] ?? []
    return team.filter(u => {
      if (u.ruolo === 'admin') return false
      if (u.ruolo === 'responsabile') return utentiConNormeIds.includes(u.id)
      return opsIds.includes(u.id)
    })
  }

  // ── Validazioni ──────────────────────────────────────────────
  const step1Valid =
    !!clienteId &&
    norme.length >= 2 &&
    !norme.includes('SA 8000') &&
    (tipoContatto === 'consulente' ? !!consulenteId : !!referenteNome.trim())

  const step2Valid =
    praticheData.length === norme.length &&
    praticheData.every(p => !!p.data_scadenza)

  const handleSubmit = async () => {
    try {
      const isConsulente = tipoContatto === 'consulente'
      await createAudit.mutateAsync({
        cliente_id: clienteId,
        ciclo,
        tipo_contatto: tipoContatto,
        consulente_id: isConsulente ? (consulenteId || null) : null,
        referente_nome:  isConsulente ? null : (referenteNome.trim() || null),
        referente_email: isConsulente ? null : (referenteEmail.trim() || null),
        referente_tel:   isConsulente ? null : (referenteTel.trim() || null),
        note: note.trim() || null,
        pratiche: praticheData,
      })
      onClose()
    } catch {
      // errore gestito dalla mutation (toast/inline)
    }
  }

  const clienteNome = clienti.find(c => c.id === clienteId)?.nome ?? ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header viola */}
        <DialogHeader className="px-6 py-4 border-b border-secondary/20 bg-secondary/5 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-secondary">
            <Sparkles className="w-5 h-5" />
            Nuovo Audit Integrato
            <span className="text-xs text-muted-foreground font-normal ml-2">
              Step {step + 1} di 3
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-border/40 flex items-center gap-2">
          {['Dati comuni', 'Pratiche', 'Riepilogo'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? 'bg-secondary text-white'
                : i === step ? 'bg-secondary/20 text-secondary border border-secondary/40'
                : 'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-secondary font-medium' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── Step 1: Dati comuni ────────────────────── */}
          {step === 0 && (
            <>
              {/* Cliente + QuickAdd */}
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                  <SelectContent>
                    {clienti.filter(c => c.attivo).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome ?? c.ragione_sociale ?? c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="pt-1">
                  <QuickAddCliente
                    onClienteCreato={(c) => setClienteId(c.id)}
                  />
                </div>
              </div>

              {/* Ciclo */}
              <div className="space-y-1.5">
                <Label className="text-xs">Ciclo</Label>
                <Select value={ciclo} onValueChange={(v) => setCiclo(v as CicloType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CICLI.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Norme */}
              <div className="space-y-1.5">
                <Label className="text-xs">Norme (minimo 2, SA 8000 esclusa) *</Label>
                <NormeMultiSelect value={norme} onChange={syncPratiche} />
                {norme.includes('SA 8000') && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    SA 8000 non può far parte di un audit integrato (ciclo 36 mesi)
                  </p>
                )}
              </div>

              {/* Tipo Contatto — toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo Contatto</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoContatto('consulente')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      tipoContatto === 'consulente'
                        ? 'bg-secondary/10 border-secondary/40 text-secondary'
                        : 'border-border text-muted-foreground hover:border-secondary/30'
                    }`}
                  >
                    Tramite Consulente
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoContatto('diretto')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      tipoContatto === 'diretto'
                        ? 'bg-secondary/10 border-secondary/40 text-secondary'
                        : 'border-border text-muted-foreground hover:border-secondary/30'
                    }`}
                  >
                    Referente Diretto
                  </button>
                </div>
              </div>

              {/* Campi consulente o referente */}
              {tipoContatto === 'consulente' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Consulente *</Label>
                  <Select value={consulenteId} onValueChange={setConsulenteId}>
                    <SelectTrigger><SelectValue placeholder="Seleziona consulente" /></SelectTrigger>
                    <SelectContent>
                      {consulenti.filter(c => c.attivo).map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {[c.nome, c.cognome].filter(Boolean).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="pt-1">
                    <QuickAddConsulente
                      onConsulenteCreato={(c) => setConsulenteId(c.id)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome Referente *</Label>
                    <Input
                      placeholder="Mario Rossi"
                      value={referenteNome}
                      onChange={(e) => setReferenteNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      placeholder="email@..."
                      value={referenteEmail}
                      onChange={(e) => setReferenteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefono</Label>
                    <Input
                      placeholder="+39 ..."
                      value={referenteTel}
                      onChange={(e) => setReferenteTel(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-xs">Note audit</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note generali sull'audit integrato..."
                />
              </div>
            </>
          )}

          {/* ── Step 2: Per-pratica ────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Configura ogni pratica dell'audit. Cliente, ciclo e contatto sono già impostati.
                Gli operatori sono filtrati in base alla norma. Auditor, sede e data verifica
                potranno essere compilati successivamente dalla scheda della singola pratica.
              </p>

              {praticheData.map((p, idx) => {
                const filteredTeam = getFilteredTeam(p.norma_codice)
                return (
                  <div
                    key={p.norma_codice}
                    className="border border-secondary/20 rounded-lg p-4 space-y-3 bg-secondary/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-secondary">
                        Pratica {idx + 1}
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {p.norma_codice}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Operatore assegnato</Label>
                        <Select
                          value={p.assegnato_a ?? ''}
                          onValueChange={(v) => updatePratica(idx, 'assegnato_a', v === '__none__' ? null : v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Non assegnato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Nessuno —</SelectItem>
                            {filteredTeam.map(u => (
                              <SelectItem key={u.id} value={u.id}>
                                {[u.nome, u.cognome].filter(Boolean).join(' ')}
                                {u.ruolo === 'responsabile' ? ' (Resp.)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {filteredTeam.length === 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            Nessun utente competente per {p.norma_codice}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px]">Data scadenza *</Label>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={p.data_scadenza ?? ''}
                          onChange={(e) => updatePratica(idx, 'data_scadenza', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Step 3: Riepilogo ─────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-secondary">Riepilogo Audit Integrato</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Cliente:</span> {clienteNome}</div>
                  <div><span className="text-muted-foreground">Ciclo:</span> {CICLI.find(c => c.value === ciclo)?.label}</div>
                  <div><span className="text-muted-foreground">Contatto:</span> {tipoContatto === 'consulente'
                    ? (consulenti.find(c => c.id === consulenteId)
                        ? [consulenti.find(c => c.id === consulenteId)?.nome, consulenti.find(c => c.id === consulenteId)?.cognome].filter(Boolean).join(' ')
                        : '—')
                    : (referenteNome || '—')}
                  </div>
                  <div><span className="text-muted-foreground">Pratiche:</span> {praticheData.length}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Norme:</span> {norme.join(' + ')}</div>
                </div>
              </div>

              <div className="space-y-2">
                {praticheData.map((p, idx) => {
                  const resp = team.find(u => u.id === p.assegnato_a)
                  return (
                    <div key={p.norma_codice} className="flex items-center gap-3 text-xs border border-border/40 rounded-lg px-3 py-2">
                      <span className="font-bold text-secondary">{idx + 1}</span>
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{p.norma_codice}</span>
                      {resp ? (
                        <span className="text-muted-foreground">
                          {[resp.nome, resp.cognome].filter(Boolean).join(' ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 italic">Non assegnato</span>
                      )}
                      {p.data_scadenza && (
                        <span className="ml-auto text-muted-foreground">{p.data_scadenza}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {createAudit.error && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {(createAudit.error as Error).message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 0 ? onClose() : setStep(step - 1)}
            disabled={createAudit.isPending}
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            {step === 0 ? 'Annulla' : 'Indietro'}
          </Button>

          {step < 2 ? (
            <Button
              size="sm"
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              onClick={() => {
                if (step === 0) syncPratiche(norme)
                setStep(step + 1)
              }}
              disabled={step === 0 ? !step1Valid : !step2Valid}
            >
              Avanti
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              onClick={handleSubmit}
              disabled={createAudit.isPending}
            >
              {createAudit.isPending ? 'Creazione...' : 'Crea Audit Integrato'}
              <Check className="w-3.5 h-3.5 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
