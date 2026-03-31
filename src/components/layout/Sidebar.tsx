import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  FolderOpen,
  GitBranch,
  Calendar,
  Database,
  ChevronDown,
  Bell,
  LogOut,
  Shield,
  Users,
  UserCheck,
  Archive,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { APP_CONFIG } from '@/config/app.config'
import { Button } from '@/components/ui/button'

// ── Configurazione navigazione ───────────────────────────────────

const NAV_MAIN = [
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/pratiche', label: 'Pratiche', icon: FolderOpen },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { path: '/scadenze', label: 'Scadenze', icon: Calendar },
] as const

const DATABASE_SUB = [
  { path: '/database/clienti', label: 'Clienti', icon: Users },
  { path: '/database/consulenti', label: 'Consulenti', icon: UserCheck },
  { path: '/database/archivio', label: 'Archivio', icon: Archive },
  { path: '/promemoria', label: 'Promemoria', icon: ClipboardList },
] as const

// ── Helper: classi NavLink ────────────────────────────────────────

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-primary/15 text-primary font-medium'
      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
  )
}

function subLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-primary/10 text-primary font-medium'
      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
  )
}

// ── Avatar con iniziali ───────────────────────────────────────────

interface UserAvatarProps {
  nome: string
  cognome: string | null
  avatarUrl: string | null
  size?: 'sm' | 'md'
}

function UserAvatar({ nome, cognome, avatarUrl, size = 'md' }: UserAvatarProps) {
  const initials = `${nome.charAt(0)}${cognome?.charAt(0) ?? ''}`.toUpperCase()
  const sizeClass = size === 'sm' ? 'size-7 text-xs' : 'size-8 text-sm'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${nome} ${cognome ?? ''}`}
        className={cn('rounded-full object-cover flex-shrink-0', sizeClass)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/20 text-primary font-semibold flex-shrink-0',
        sizeClass
      )}
    >
      {initials}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────

// Placeholder contatore notifiche — verrà collegato in F6.2
const NOTIFICHE_NON_LETTE = 0

export function Sidebar() {
  const location = useLocation()
  const { userProfile, logout } = useAuth()

  const isDatabaseActive = location.pathname.startsWith('/database') ||
    location.pathname === '/promemoria'
  const [databaseExpanded, setDatabaseExpanded] = useState(isDatabaseActive)

  // Auto-espandi quando si naviga su una rotta database
  useEffect(() => {
    if (isDatabaseActive) setDatabaseExpanded(true)
  }, [isDatabaseActive])

  const nomeCompleto = userProfile
    ? `${userProfile.nome}${userProfile.cognome ? ' ' + userProfile.cognome : ''}`
    : ''

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-border bg-card">

      {/* ── Logo / Brand ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
          <Shield className="size-4 text-primary" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{APP_CONFIG.name}</p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {APP_CONFIG.clienteName}
          </p>
        </div>
      </div>

      {/* ── Navigazione principale ───────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

        {/* Voci principali */}
        {NAV_MAIN.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} className={navLinkClass}>
            <Icon className="size-4 flex-shrink-0" strokeWidth={1.5} />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Database — sezione espandibile */}
        <div>
          <button
            onClick={() => setDatabaseExpanded((prev) => !prev)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isDatabaseActive
                ? 'text-primary font-medium'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Database className="size-4 flex-shrink-0" strokeWidth={1.5} />
            <span className="flex-1 text-left">Database</span>
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-200',
                databaseExpanded && 'rotate-180'
              )}
            />
          </button>

          {databaseExpanded && (
            <div className="ml-7 mt-0.5 space-y-0.5 border-l border-border pl-3">
              {DATABASE_SUB.map(({ path, label, icon: Icon }) => (
                <NavLink key={path} to={path} className={subLinkClass}>
                  <Icon className="size-3.5 flex-shrink-0" strokeWidth={1.5} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ── Area inferiore ───────────────────────────────────────── */}
      <div className="border-t border-border px-2 py-3 space-y-1">

        {/* Notifiche */}
        <button
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          <div className="relative flex-shrink-0">
            <Bell className="size-4" strokeWidth={1.5} />
            {NOTIFICHE_NON_LETTE > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {NOTIFICHE_NON_LETTE > 9 ? '9+' : NOTIFICHE_NON_LETTE}
              </span>
            )}
          </div>
          <span>Notifiche</span>
          {NOTIFICHE_NON_LETTE > 0 && (
            <span className="ml-auto rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              {NOTIFICHE_NON_LETTE}
            </span>
          )}
        </button>
      </div>

      {/* ── Utente + Logout ──────────────────────────────────────── */}
      <div className="border-t border-border p-3">
        {userProfile && (
          <div className="flex items-center gap-2.5">
            <UserAvatar
              nome={userProfile.nome}
              cognome={userProfile.cognome}
              avatarUrl={userProfile.avatar_url}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground leading-tight">
                {nomeCompleto}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                {userProfile.ruolo}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Esci"
              className="size-7 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <LogOut className="size-3.5" strokeWidth={1.5} />
            </Button>
          </div>
        )}

        {/* Versione */}
        <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
          v0.1.0
        </p>
      </div>
    </aside>
  )
}
