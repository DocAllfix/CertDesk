/**
 * AuditIntegratoDettaglioPage — dettaglio singolo audit integrato.
 *
 * Mostra: header con numero audit + stato, lista pratiche figlie
 * con fase/norma/assegnato, link a ciascuna pratica, note.
 * Azioni: elimina audit, collega pratica esistente, scollega pratica.
 */
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronRight, Sparkles, Check,
  ExternalLink, Loader2, Trash2, Plus, Unlink,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { BadgeFase } from '@/components/shared/BadgeFase'
import { BadgeCiclo } from '@/components/shared/BadgeCiclo'
import { BadgeUrgenza } from '@/components/shared/BadgeUrgenza'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

import {
  useAuditIntegrato, useDeleteAuditIntegrato,
  useCollegaPraticaAdAudit, useScollegaPraticaDaAudit,
} from '@/hooks/useAuditIntegrati'
import { usePratiche } from '@/hooks/usePratiche'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

import type { FaseType, PraticaListItem } from '@/types/app.types'

// ── Helpers ──────────────────────────────────────────────────────

const FASE_ORDINE: Record<FaseType, number> = {
  contratto_firmato:       1,
  programmazione_verifica: 2,
  richiesta_proforma:      3,
  elaborazione_pratica:    4,
  firme:                   5,
  completata:              6,
}

function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM yyyy', { locale: it }) }
  catch { return d }
}

function nomeUtente(u: { nome: string | null; cognome: string | null } | null | undefined): string {
  if (!u) return '—'
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '—'
}

function iniziali(u: { nome: string | null; cognome: string | null } | null | undefined): string {
  if (!u) return '?'
  return ((u.nome?.[0] ?? '') + (u.cognome?.[0] ?? '')).toUpperCase() || '?'
}

// ── Dialog collega pratica ───────────────────────────────────────

function CollegaPraticaDialog({
  open,
  onClose,
  auditId,
  clienteId,
  praticheGiaCollegate,
}: {
  open: boolean
  onClose: () => void
  auditId: string
  clienteId: string
  praticheGiaCollegate: string[]
}) {
  const collegaMut = useCollegaPraticaAdAudit()
  const { data: rawPratiche = [], isLoading } = usePratiche({
    cliente_id: clienteId,
    solo_attive: true,
  })
  const pratiche = rawPratiche as PraticaListItem[]

  // Filtra: solo pratiche dello stesso cliente, non già nell'audit, senza audit
  const disponibili = pratiche.filter(
    p => !praticheGiaCollegate.includes(p.id) && !p.audit
  )

  const handleCollega = async (praticaId: string) => {
    try {
      await collegaMut.mutateAsync({ praticaId, auditId })
      toast.success('Pratica collegata all\'audit')
      onClose()
    } catch (err) {
      toast.error('Errore', { description: (err as Error).message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-secondary">
            <Plus className="w-4 h-4" />
            Collega pratica esistente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && disponibili.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nessuna pratica disponibile per questo cliente
            </p>
          )}
          {disponibili.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleCollega(p.id)}
              disabled={collegaMut.isPending}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">
                  {p.numero_pratica ?? '—'}
                </span>
                <div className="flex gap-1">
                  {p.norme.map(n => (
                    <span key={n.codice} className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {n.codice}
                    </span>
                  ))}
                </div>
                <BadgeFase fase={p.fase} short />
              </div>
              <Plus className="w-3.5 h-3.5 text-secondary" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Componente principale ────────────────────────────────────────

export default function AuditIntegratoDettaglioPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { data: audit, isLoading, error } = useAuditIntegrato(id)
  const deleteMut = useDeleteAuditIntegrato()
  const scollegaMut = useScollegaPraticaDaAudit()
  const [collegaOpen, setCollegaOpen] = useState(false)

  const handleDelete = async () => {
    if (!audit || !id) return
    if (!confirm('Eliminare questo audit integrato? Le pratiche resteranno come pratiche singole.')) return
    try {
      await deleteMut.mutateAsync(id)
      toast.success('Audit integrato eliminato')
      navigate('/audit-integrati')
    } catch (err) {
      toast.error('Errore', { description: (err as Error).message })
    }
  }

  const handleScollega = async (praticaId: string, numeroPratica: string | null) => {
    if (!confirm(`Scollegare la pratica ${numeroPratica ?? ''} dall'audit?`)) return
    try {
      await scollegaMut.mutateAsync(praticaId)
      toast.success('Pratica scollegata dall\'audit')
    } catch (err) {
      toast.error('Errore', { description: (err as Error).message })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-destructive">{error ? (error as Error).message : 'Audit non trovato'}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/audit-integrati')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Torna alla lista
        </Button>
      </div>
    )
  }

  const clienteNome = audit.cliente?.nome ?? audit.cliente?.ragione_sociale ?? '—'
  const progressPercent = audit.pratiche_totali > 0
    ? Math.round((audit.pratiche_completate / audit.pratiche_totali) * 100)
    : 0

  return (
    <div className="space-y-5 max-w-[1200px]">

      {/* Header card */}
      <div className="bg-card rounded-xl border border-border p-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Link to="/audit-integrati" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-sm text-muted-foreground">Audit Integrati</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-sm text-foreground font-medium">
            {audit.numero_audit ?? '—'}
          </span>
        </div>

        {/* Titolo + stato */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              <h2 className="text-xl font-semibold text-foreground">{audit.numero_audit}</h2>
              {audit.is_completato && (
                <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Completato
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="text-foreground font-medium">{clienteNome}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-secondary hover:text-secondary border-secondary/30 hover:bg-secondary/10"
              onClick={() => setCollegaOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Collega pratica
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Elimina audit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Avanzamento</span>
          <span className="text-sm text-muted-foreground">
            {audit.pratiche_completate}/{audit.pratiche_totali} pratiche completate ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Lista pratiche */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Pratiche dell'audit</h3>
          <span className="text-xs text-muted-foreground">{audit.pratiche.length} pratiche</span>
        </div>

        <div className="divide-y divide-border/40">
          {audit.pratiche.map((p, idx) => {
            const faseOrd = FASE_ORDINE[p.fase as FaseType] ?? 0
            const normaLabel = p.norme?.[0]?.codice ?? '—'

            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Progressivo */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    faseOrd === 6
                      ? 'bg-success text-white'
                      : 'bg-secondary/10 text-secondary border border-secondary/20'
                  }`}>
                    {faseOrd === 6 ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>

                  {/* Numero pratica */}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {p.numero_pratica ?? '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {normaLabel}
                    </p>
                  </div>

                  {/* Fase */}
                  <BadgeFase fase={p.fase as FaseType} short />

                  {/* Ciclo */}
                  {p.ciclo && <BadgeCiclo ciclo={p.ciclo} />}
                </div>

                <div className="flex items-center gap-3">
                  {/* Scadenza */}
                  {p.data_scadenza && (
                    <div className="flex items-center gap-1.5">
                      <BadgeUrgenza dataScadenza={p.data_scadenza} className="text-[10px]" />
                      <span className="text-xs text-muted-foreground">{fmtData(p.data_scadenza)}</span>
                    </div>
                  )}

                  {/* Assegnato */}
                  {p.assegnato && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-primary">{iniziali(p.assegnato)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground hidden lg:inline">
                        {nomeUtente(p.assegnato).split(' ')[0]}
                      </span>
                    </div>
                  )}

                  {/* Scollega */}
                  {isAdmin && audit.pratiche.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleScollega(p.id, p.numero_pratica)}
                      disabled={scollegaMut.isPending}
                      className="text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-50"
                      title="Scollega dall'audit"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Link dettaglio */}
                  <Link
                    to={`/pratiche/${p.id}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Apri pratica"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Note */}
      {audit.note && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-2">Note</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{audit.note}</p>
        </div>
      )}

      {/* Info */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-3">Informazioni</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Creato il</p>
            <p className="text-foreground">{fmtData(audit.created_at)}</p>
          </div>
          {audit.prima_scadenza && (
            <div>
              <p className="text-xs text-muted-foreground">Prima scadenza</p>
              <p className="text-foreground">{fmtData(audit.prima_scadenza)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog collega pratica */}
      {collegaOpen && (
        <CollegaPraticaDialog
          open={collegaOpen}
          onClose={() => setCollegaOpen(false)}
          auditId={id!}
          clienteId={audit.cliente_id}
          praticheGiaCollegate={audit.pratiche.map(p => p.id)}
        />
      )}
    </div>
  )
}
