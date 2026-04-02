/**
 * Sidebar — navigazione collassabile con tooltip.
 * Ref: ../evalisdesk-ref/src/components/layout/Sidebar.jsx
 *
 * Struttura:
 *   ┌─ Logo/brand ─────────────────┐
 *   │  Nav items (main + database) │ flex-1 overflow-y-auto
 *   ├─ Bottom section ─────────────┤
 *   │  Notifiche · ConnectionInd.  │
 *   │  User + Logout               │
 *   └──────────────────────────────┘
 *   Collapse toggle: assoluto a destra a h=72px
 */
import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, Columns3, CalendarClock,
  Database, Users, UserCheck, Archive, ClipboardList,
  ChevronLeft, ChevronRight, ChevronDown, LogOut,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ConnectionIndicator } from './ConnectionIndicator'
import { NotificheBadgeSidebar } from '@/components/notifiche'
import { useAuth } from '@/hooks/useAuth'
import { APP_CONFIG } from '@/config/app.config'

// ── Navigazione ─────────────────────────────────────────────────────

const NAV_MAIN = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pratiche',  label: 'Pratiche',  icon: FolderKanban    },
  { path: '/pipeline',  label: 'Pipeline',  icon: Columns3        },
  { path: '/scadenze',  label: 'Scadenze',  icon: CalendarClock   },
] as const

const DATABASE_SUB = [
  { path: '/database/clienti',    label: 'Clienti',    icon: Users         },
  { path: '/database/consulenti', label: 'Consulenti', icon: UserCheck     },
  { path: '/database/archivio',   label: 'Archivio',   icon: Archive       },
  { path: '/promemoria',          label: 'Promemoria', icon: ClipboardList },
] as const

// ── Props ────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenNotifications: () => void

}

// ── UserAvatar ───────────────────────────────────────────────────────

interface UserAvatarProps {
  nome: string
  cognome: string | null
  avatarUrl: string | null
  size?: 'sm' | 'md'
}

function UserAvatar({ nome, cognome, avatarUrl, size = 'md' }: UserAvatarProps) {
  const initials = `${nome.charAt(0)}${cognome?.charAt(0) ?? ''}`.toUpperCase()
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[10px]'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <div className={`${sizeClass} rounded-full bg-primary flex items-center justify-center shrink-0`}>
      <span className="text-primary-foreground font-bold">{initials}</span>
    </div>
  )
}

// ── NavItem ──────────────────────────────────────────────────────────

interface NavItemProps {
  path: string
  label: string
  icon: React.ElementType
  collapsed: boolean
  exact?: boolean
}

function NavItem({ path, label, icon: Icon, collapsed, exact = false }: NavItemProps) {
  const location = useLocation()
  const isActive = exact
    ? location.pathname === path
    : location.pathname === path || location.pathname.startsWith(path + '/')

  const content = (
    <NavLink
      to={path}
      className={`group flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 relative cursor-pointer ${
        isActive
          ? 'bg-sidebar-accent text-sidebar-primary'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-sidebar-primary rounded-r-full" />
      )}
      <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
      {!collapsed && (
        <span
          className="text-[14px] leading-5 truncate"
          style={{ fontWeight: isActive ? 600 : 400 }}
        >
          {label}
        </span>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="ml-1">{label}</TooltipContent>
      </Tooltip>
    )
  }
  return content
}

// ── Sidebar ──────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle, onOpenNotifications }: SidebarProps) {
  const location = useLocation()
  const { userProfile, logout } = useAuth()

  const isDatabaseActive =
    location.pathname.startsWith('/database') ||
    location.pathname === '/promemoria'

  const [dbOpen, setDbOpen] = useState(isDatabaseActive)

  useEffect(() => {
    if (isDatabaseActive) setDbOpen(true)
  }, [isDatabaseActive])

  const nomeCompleto = userProfile
    ? `${userProfile.nome}${userProfile.cognome ? ' ' + userProfile.cognome : ''}`
    : ''

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-40 transition-all duration-300 ${
          collapsed ? 'w-[56px]' : 'w-[255px]'
        }`}
      >
        {/* ── Brand ─────────────────────────────────────────────── */}
        <div
          className={`flex items-center gap-2.5 h-14 border-b border-sidebar-border shrink-0 ${
            collapsed ? 'px-3 justify-center' : 'px-4'
          }`}
        >
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={APP_CONFIG.logoUrl}
              alt={APP_CONFIG.name}
              className="w-full h-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sidebar-accent-foreground font-semibold text-sm leading-tight truncate">
                {APP_CONFIG.name}
              </p>
              <p className="text-sidebar-foreground text-[10px] truncate">
                {APP_CONFIG.clienteName}
              </p>
            </div>
          )}
        </div>

        {/* ── Navigation ────────────────────────────────────────── */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">

          {/* Main nav */}
          {NAV_MAIN.map(({ path, label, icon }) => (
            <NavItem
              key={path}
              path={path}
              label={label}
              icon={icon}
              collapsed={collapsed}
            />
          ))}

          {/* Database espandibile */}
          {collapsed ? (
            /* In modalità collapsed: ogni sotto-voce come NavItem separato */
            DATABASE_SUB.map(({ path, label, icon }) => (
              <NavItem
                key={path}
                path={path}
                label={label}
                icon={icon}
                collapsed={collapsed}
              />
            ))
          ) : (
            <div>
              <button
                onClick={() => setDbOpen(p => !p)}
                className={`group flex w-full items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 cursor-pointer ${
                  isDatabaseActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                }`}
              >
                {isDatabaseActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-sidebar-primary rounded-r-full" />
                )}
                <Database
                  className="w-4 h-4 shrink-0"
                  strokeWidth={isDatabaseActive ? 2 : 1.75}
                />
                <span
                  className="flex-1 text-left text-[14px] leading-5"
                  style={{ fontWeight: isDatabaseActive ? 600 : 400 }}
                >
                  Database
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${dbOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dbOpen && (
                <div className="mt-0.5 space-y-0.5 pl-2">
                  {DATABASE_SUB.map(({ path, label, icon: Icon }) => {
                    const isActive = location.pathname === path
                    return (
                      <NavLink
                        key={path}
                        to={path}
                        className={`flex items-center gap-2 rounded-md pl-6 pr-3 py-1.5 text-[13px] transition-all duration-150 ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-primary font-semibold'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground font-medium'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                        {label}
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* ── Bottom section ────────────────────────────────────── */}
        <div className="border-t border-sidebar-border p-2 space-y-0.5 shrink-0">

          {/* Notifiche */}
          <NotificheBadgeSidebar onClick={onOpenNotifications} collapsed={collapsed} />

          {/* ConnectionIndicator */}
          <ConnectionIndicator collapsed={collapsed} />

          {/* User */}
          {userProfile && (
            <div
              className={`flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-md bg-sidebar-accent/40 ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <UserAvatar
                nome={userProfile.nome}
                cognome={userProfile.cognome}
                avatarUrl={userProfile.avatar_url}
              />
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-sidebar-accent-foreground truncate leading-none">
                      {nomeCompleto}
                    </p>
                    <p className="text-[10px] text-sidebar-foreground capitalize mt-0.5">
                      {userProfile.ruolo}
                    </p>
                  </div>
                  <button
                    onClick={logout}
                    title="Esci"
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-sidebar-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Collapse toggle ────────────────────────────────────── */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-[72px] w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors z-10"
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3 text-muted-foreground" />
            : <ChevronLeft  className="w-3 h-3 text-muted-foreground" />
          }
        </button>
      </aside>
    </TooltipProvider>
  )
}
