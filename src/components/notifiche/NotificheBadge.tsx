/**
 * NotificheBadge — icona Bell con badge rosso contatore non lette.
 * Ref: ../evalisdesk-ref/src/components/layout/Header.jsx
 *      ../evalisdesk-ref/src/components/layout/Sidebar.jsx
 *
 * Legge useNotificheCount() internamente → aggiornamento real-time automatico.
 * Variante 'header': bottone ghost 8x8 con badge assoluto
 * Variante 'sidebar': stile sidebar con label opzionale
 */
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useNotificheCount } from '@/hooks/useNotifiche'

// ── Badge dot ────────────────────────────────────────────────────

function BadgeCount({ count, position }: { count: number; position: 'header' | 'sidebar-expanded' | 'sidebar-collapsed' }) {
  if (count === 0) return null
  const label = count > 9 ? '9+' : String(count)

  if (position === 'header') {
    return (
      <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
        {label}
      </span>
    )
  }
  if (position === 'sidebar-collapsed') {
    return (
      <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
        {label}
      </span>
    )
  }
  // sidebar-expanded
  return (
    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
      {label}
    </span>
  )
}

// ── Variante Header ──────────────────────────────────────────────

interface HeaderBadgeProps {
  onClick: () => void
}

export function NotificheBadgeHeader({ onClick }: HeaderBadgeProps) {
  const count = useNotificheCount()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative w-8 h-8 text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <Bell className="w-4 h-4" />
      <BadgeCount count={count} position="header" />
    </Button>
  )
}

// ── Variante Sidebar ─────────────────────────────────────────────

interface SidebarBadgeProps {
  onClick:   () => void
  collapsed: boolean
}

export function NotificheBadgeSidebar({ onClick, collapsed }: SidebarBadgeProps) {
  const count = useNotificheCount()

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className="w-full flex items-center justify-center px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground transition-all duration-150 relative"
          >
            <Bell className="w-4 h-4" strokeWidth={1.75} />
            <BadgeCount count={count} position="sidebar-collapsed" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Notifiche</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground transition-all duration-150"
    >
      <div className="relative shrink-0">
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        <BadgeCount count={count} position="sidebar-expanded" />
      </div>
      <span className="text-sm font-medium">Notifiche</span>
    </button>
  )
}
