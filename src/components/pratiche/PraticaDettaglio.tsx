/**
 * PraticaDettaglio — pagina completa dettaglio pratica.
 *
 * Layout a due colonne (3/5 + 2/5), stepper fasi, banner stato,
 * alert blocco documenti. Sezioni allegati e comunicazione sono
 * placeholder fino a F7/F8.
 *
 * Design ref: ../evalisdesk-ref/src/pages/DettaglioPratica.jsx
 *             ../evalisdesk-ref/src/components/dettaglio/
 *             ../evalisdesk-ref/src/components/shared/PhaseStepper.jsx
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Sparkles, Check,
  User, Calendar, MapPin,
  Building2, FileText, Phone, Mail, MessageSquare, Paperclip,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { BadgeFase } from '@/components/shared/BadgeFase'
import { BadgeCiclo } from '@/components/shared/BadgeCiclo'
import { BadgeStato } from '@/components/shared/BadgeStato'
import { PraticaModal }          from './PraticaModal'
import { AvanzaFaseModal }       from './AvanzaFaseModal'
import { BloccoDocumentiAlert }  from './BloccoDocumentiAlert'
import { StatoPraticaBanner }    from './StatoPraticaBanner'

import type { PraticaConRelazioni, FaseType } from '@/types/app.types'

// ── Costanti fasi ─────────────────────────────────────────────────

interface FaseStep {
  fase: FaseType
  short: string
  stepColor: string
  ringColor: string
  connColor: string
}

const FASI: FaseStep[] = [
  { fase: 'contratto_firmato',       short: 'Contratto',    stepColor: 'bg-phase-1', ringColor: 'ring-phase-1/30', connColor: 'bg-phase-1' },
  { fase: 'programmazione_verifica', short: 'Verifica',     stepColor: 'bg-phase-2', ringColor: 'ring-phase-2/30', connColor: 'bg-phase-2' },
  { fase: 'richiesta_proforma',      short: 'Proforma',     stepColor: 'bg-phase-3', ringColor: 'ring-phase-3/30', connColor: 'bg-phase-3' },
  { fase: 'elaborazione_pratica',    short: 'Elaborazione', stepColor: 'bg-phase-4', ringColor: 'ring-phase-4/30', connColor: 'bg-phase-4' },
  { fase: 'firme',                   short: 'Firme',        stepColor: 'bg-phase-5', ringColor: 'ring-phase-5/30', connColor: 'bg-phase-5' },
  { fase: 'completata',              short: 'Completata',   stepColor: 'bg-success',  ringColor: 'ring-success/30',  connColor: 'bg-success'  },
]

const FASE_ORDINE: Record<FaseType, number> = {
  contratto_firmato:       1,
  programmazione_verifica: 2,
  richiesta_proforma:      3,
  elaborazione_pratica:    4,
  firme:                   5,
  completata:              6,
}

const FASE_NEXT: Partial<Record<FaseType, FaseType>> = {
  contratto_firmato:       'programmazione_verifica',
  programmazione_verifica: 'richiesta_proforma',
  richiesta_proforma:      'elaborazione_pratica',
  elaborazione_pratica:    'firme',
  firme:                   'completata',
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtData(d: string | null | undefined): string {
  if (!d) return '\u2014'
  try { return format(new Date(d), 'd MMMM yyyy', { locale: it }) }
  catch { return d }
}

function nomeUtente(u: { nome: string | null; cognome: string | null } | null | undefined): string {
  if (!u) return '\u2014'
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '\u2014'
}

function iniziali(u: { nome: string | null; cognome: string | null } | null | undefined): string {
  if (!u) return '?'
  const n = u.nome?.[0] ?? ''
  const c = u.cognome?.[0] ?? ''
  return (n + c).toUpperCase() || '?'
}

// ── Props ─────────────────────────────────────────────────────────

interface PraticaDettaglioProps {
  pratica: PraticaConRelazioni
}

// ── Componente ────────────────────────────────────────────────────

export function PraticaDettaglio({ pratica }: PraticaDettaglioProps) {
  const [editOpen,   setEditOpen]   = useState(false)
  const [avanzaOpen, setAvanzaOpen] = useState(false)

  const faseAttuale  = pratica.fase
  const faseOrdine   = FASE_ORDINE[faseAttuale]
  const faseNext     = FASE_NEXT[faseAttuale]

  const clienteNome  = pratica.cliente?.nome ?? pratica.cliente?.ragione_sociale ?? '\u2014'

  // Banner stato e blocco documenti ora usano i componenti reali F5

  // ── Header card ───────────────────────────────────────────────

  const renderHeader = () => (
    <div className="bg-card rounded-xl border border-border p-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/pratiche" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm text-muted-foreground">Pratiche</span>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-sm text-foreground font-medium">
          {pratica.numero_pratica ?? '\u2014'}
        </span>
      </div>

      {/* Titolo + badges + azioni */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h2 className="text-xl font-semibold text-foreground">{clienteNome}</h2>
            <BadgeFase fase={faseAttuale} />
            <BadgeCiclo ciclo={pratica.ciclo} />
            {pratica.stato !== 'attiva' && <BadgeStato stato={pratica.stato} />}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pratica.norme.map((n) => (
              <span key={n.codice} className="text-xs bg-muted px-2.5 py-1 rounded-md text-muted-foreground font-medium">
                {n.codice}
              </span>
            ))}
            {pratica.norme.length > 1 && (
              <span className="text-xs bg-secondary/10 text-secondary px-2.5 py-1 rounded-md font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Audit Integrato
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-sm"
            onClick={() => setEditOpen(true)}
          >
            Modifica
          </Button>
          {faseNext && pratica.stato === 'attiva' && (
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3 text-sm cursor-pointer"
              onClick={() => setAvanzaOpen(true)}
            >
              Avanza a{' '}
              <BadgeFase fase={faseNext} short className="ml-1.5 bg-white/10 border-white/20 text-white" />
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  // ── Phase Stepper ─────────────────────────────────────────────

  const renderStepper = () => (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center w-full">
        {FASI.map((step, idx) => {
          const ordine     = FASE_ORDINE[step.fase]
          const completata = ordine < faseOrdine
          const corrente   = step.fase === faseAttuale
          return (
            <div key={step.fase} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    completata
                      ? `${step.stepColor} text-white`
                      : corrente
                      ? `${step.stepColor} text-white ring-4 ${step.ringColor}`
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {completata ? <Check className="w-4 h-4" /> : ordine}
                </div>
                <span className={`text-xs font-medium text-center whitespace-nowrap ${
                  corrente ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.short}
                </span>
              </div>
              {idx < FASI.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors mb-[22px] ${
                  completata ? step.connColor : 'bg-muted'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Colonna sinistra: Info generali ───────────────────────────

  const renderInfoSection = () => {
    const rows: { icon: React.ElementType; label: string; value: string }[] = [
      { icon: Building2, label: 'Cliente',        value: clienteNome },
      { icon: FileText,  label: 'Numero pratica', value: pratica.numero_pratica ?? '\u2014' },
      {
        icon: User,
        label: 'Tipo Contatto',
        value: pratica.tipo_contatto === 'consulente'
          ? `Consulente: ${nomeUtente(pratica.consulente)}`
          : 'Referente Diretto',
      },
    ]

    if (pratica.tipo_contatto === 'diretto') {
      if (pratica.referente_nome)  rows.push({ icon: User,     label: 'Referente', value: pratica.referente_nome })
      if (pratica.referente_email) rows.push({ icon: Mail,     label: 'Email',     value: pratica.referente_email })
      if (pratica.referente_tel)   rows.push({ icon: Phone,    label: 'Telefono',  value: pratica.referente_tel })
    }

    rows.push(
      { icon: User,     label: 'Assegnato a', value: nomeUtente(pratica.assegnato) },
      { icon: Calendar, label: 'Scadenza',     value: fmtData(pratica.data_scadenza) },
    )

    if (pratica.auditor)                  rows.push({ icon: User,     label: 'Auditor',          value: nomeUtente(pratica.auditor) })
    if (pratica.data_verifica)            rows.push({ icon: Calendar, label: 'Data Verifica',     value: fmtData(pratica.data_verifica) })
    if (pratica.sede_verifica)            rows.push({ icon: MapPin,   label: 'Sede Verifica',     value: pratica.sede_verifica })
    if (pratica.numero_certificato)       rows.push({ icon: FileText, label: 'Num. Certificato',  value: pratica.numero_certificato })
    if (pratica.data_emissione_certificato) rows.push({ icon: Calendar, label: 'Emissione Cert.', value: fmtData(pratica.data_emissione_certificato) })
    if (pratica.data_scadenza_certificato)  rows.push({ icon: Calendar, label: 'Scadenza Cert.',  value: fmtData(pratica.data_scadenza_certificato) })

    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Informazioni Generali</h3>
        </div>
        <div className="p-5 space-y-4">
          {rows.map((row) => {
            const Icon = row.icon
            return (
              <div key={row.label} className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{row.value}</p>
                </div>
              </div>
            )
          })}
          {pratica.note && (
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Note</p>
              <p className="text-sm text-foreground whitespace-pre-line">{pratica.note}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Colonna sinistra: Feed comunicazione (placeholder F8) ─────

  const renderCommunicationPlaceholder = () => (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Comunicazioni</h3>
      </div>
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Feed messaggi — implementazione in F8</p>
      </div>
    </div>
  )

  // ── Colonna destra: Assegnazione ──────────────────────────────

  const renderAssegnazionePanel = () => (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Assegnazione</h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">{iniziali(pratica.assegnato)}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{nomeUtente(pratica.assegnato)}</p>
            <p className="text-xs text-muted-foreground">Responsabile pratica</p>
          </div>
        </div>

        {pratica.auditor && (
          <div className="flex items-start gap-3 pt-3 border-t border-border/50">
            <User className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Auditor</p>
              <p className="text-sm font-medium text-foreground">{nomeUtente(pratica.auditor)}</p>
            </div>
          </div>
        )}

        {pratica.data_verifica && (
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Data Audit</p>
              <p className="text-sm font-medium text-foreground">{fmtData(pratica.data_verifica)}</p>
            </div>
          </div>
        )}

        {pratica.sede_verifica && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Luogo</p>
              <p className="text-sm font-medium text-foreground">{pratica.sede_verifica}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── Colonna destra: Checklist flag ────────────────────────────

  const renderChecklist = () => {
    type CheckItem = { label: string; value: boolean | null }
    const items: CheckItem[] = [
      { label: 'Proforma richiesta', value: pratica.proforma_richiesta },
      { label: 'Proforma emessa',    value: pratica.proforma_emessa    },
      { label: 'Documenti ricevuti', value: pratica.documenti_ricevuti },
    ]

    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Checklist</h3>
        </div>
        <div className="p-5 space-y-2">
          {items.map(({ label, value }) => (
            <div
              key={label}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                value ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                value ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {value && <Check className="w-3 h-3" />}
              </div>
              <span className="text-sm text-foreground">{label}</span>
              {!value && (
                <span className="ml-auto text-xs text-destructive font-medium">Mancante</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Colonna destra: Allegati placeholder F7 ───────────────────

  const renderAllegatiPlaceholder = () => (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Allegati</h3>
      </div>
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Gestione allegati — implementazione in F7</p>
      </div>
    </div>
  )

  // ── Render principale ─────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Banner stato (sospesa/annullata) con motivo + riattiva */}
      <StatoPraticaBanner pratica={pratica} />

      {/* Alert blocco documenti in fase 4 con "Segna ricevuti" */}
      <BloccoDocumentiAlert pratica={pratica} />

      {renderHeader()}
      {renderStepper()}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          {renderInfoSection()}
          {renderCommunicationPlaceholder()}
        </div>
        <div className="lg:col-span-2 space-y-5">
          {renderAssegnazionePanel()}
          {renderChecklist()}
          {renderAllegatiPlaceholder()}
        </div>
      </div>

      <PraticaModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        pratica={pratica}
      />

      {/* Modal avanzamento fase con prerequisiti reali */}
      {faseNext && (
        <AvanzaFaseModal
          open={avanzaOpen}
          onClose={() => setAvanzaOpen(false)}
          pratica={pratica}
          targetFase={faseNext}
        />
      )}
    </div>
  )
}
