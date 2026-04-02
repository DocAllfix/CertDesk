/**
 * Header — barra superiore: titolo pagina, ricerca, tema, notifiche, avatar.
 * Ref: ../evalisdesk-ref/src/components/layout/Header.jsx
 *
 * h-12 · bg-card · border-b · sticky top-0 z-30
 */
import { useLocation } from 'react-router-dom'
import { Search, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { NotificheBadgeHeader } from '@/components/notifiche'

// ── Mappa path → titolo pagina ───────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':            'Dashboard',
  '/pratiche':             'Pratiche',
  '/pipeline':             'Pipeline',
  '/scadenze':             'Scadenze',
  '/database/clienti':     'Clienti',
  '/database/consulenti':  'Consulenti',
  '/database/archivio':    'Archivio',
  '/promemoria':           'Promemoria',
}

function getPageTitle(pathname: string): string {
  // Match esatto
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  // Pratica dettaglio: /pratiche/:id
  if (pathname.startsWith('/pratiche/')) return 'Dettaglio Pratica'
  return 'CertDesk'
}

// ── MiniAvatar ───────────────────────────────────────────────────────

interface MiniAvatarProps {
  nome: string
  cognome: string | null
  avatarUrl: string | null
}

function MiniAvatar({ nome, cognome, avatarUrl }: MiniAvatarProps) {
  const initials = `${nome.charAt(0)}${cognome?.charAt(0) ?? ''}`.toUpperCase()
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
      <span className="text-primary-foreground text-xs font-bold">{initials}</span>
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────

interface HeaderProps {
  onOpenNotifications: () => void
}

export function Header({ onOpenNotifications }: HeaderProps) {
  const location  = useLocation()
  const { userProfile } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  const title = getPageTitle(location.pathname)

  return (
    <header className="h-12 bg-card border-b border-border flex items-center justify-between px-5 shrink-0 sticky top-0 z-30">

      {/* ── Titolo ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-poppins font-medium text-foreground leading-[34px]">
          {title}
        </h1>
      </div>

      {/* ── Azioni destra ────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* Ricerca (non funzionale fino a F9) */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cerca pratica, cliente..."
            className="w-52 pl-8 h-8 bg-muted/40 border-border/60 text-sm focus:border-primary/40 focus:bg-card transition-colors"
            readOnly
          />
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
        >
          {isDark
            ? <Sun  className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </Button>

        {/* Notifiche */}
        <NotificheBadgeHeader onClick={onOpenNotifications} />

        {/* Avatar */}
        {userProfile && (
          <MiniAvatar
            nome={userProfile.nome}
            cognome={userProfile.cognome}
            avatarUrl={userProfile.avatar_url}
          />
        )}
      </div>
    </header>
  )
}
