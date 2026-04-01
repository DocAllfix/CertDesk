/**
 * NotifichePanel — pannello notifiche slide-over da destra.
 * Ref: ../evalisdesk-ref/src/components/layout/NotificationPanel.jsx
 *
 * PLACEHOLDER — i dati reali da Supabase verranno aggiunti in F6.1-F6.2.
 * Struttura visiva già completa: header, tabs, ricerca, empty state.
 */
import { useState } from 'react'
import { X, Bell, CheckCheck, Search, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TABS = ['Tutti', 'Menzionato', 'Assegnazioni'] as const
type Tab = (typeof TABS)[number]

interface NotifichePanelProps {
  open: boolean
  onClose: () => void
}

export function NotifichePanel({ open, onClose }: NotifichePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Tutti')

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground font-poppins">Notifiche</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-muted-foreground hover:text-foreground"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Ricerca */}
          <div className="relative mt-3 mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca notifiche..."
              className="pl-8 h-8 bg-muted/40 border-border/60 text-xs"
              readOnly
            />
          </div>
        </div>

        {/* Toolbar "segna tutte lette" */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-border/40 shrink-0">
          <span className="text-xs text-muted-foreground">0 non lette</span>
          <button className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" />
            Segna tutte lette
          </button>
        </div>

        {/* Empty state — placeholder F6.2 */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Bell className="w-10 h-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">Nessuna notifica</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Le notifiche in tempo reale verranno attivate in F6.1
          </p>
        </div>
      </div>
    </>
  )
}
