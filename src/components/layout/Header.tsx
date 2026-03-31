import { useLocation, useParams, Link } from 'react-router-dom'
import { Search, Bell, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

// ── Mappa percorsi → etichette breadcrumb ────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pratiche': 'Pratiche',
  '/pipeline': 'Pipeline',
  '/scadenze': 'Scadenze',
  '/database/clienti': 'Clienti',
  '/database/consulenti': 'Consulenti',
  '/database/archivio': 'Archivio Pratiche',
  '/promemoria': 'Promemoria',
}

interface Crumb {
  label: string
  path?: string
}

function buildBreadcrumbs(pathname: string, praticaId?: string): Crumb[] {
  if (pathname.startsWith('/database/')) {
    const sub = ROUTE_LABELS[pathname] ?? 'Database'
    return [{ label: 'Database' }, { label: sub }]
  }

  if (pathname.startsWith('/pratiche/') && praticaId) {
    return [
      { label: 'Pratiche', path: '/pratiche' },
      { label: `Pratica ${praticaId}` },
    ]
  }

  return [{ label: ROUTE_LABELS[pathname] ?? 'CertDesk' }]
}

// ── Avatar mini in header ─────────────────────────────────────────

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
        className="size-7 rounded-full object-cover flex-shrink-0"
      />
    )
  }

  return (
    <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold flex-shrink-0">
      {initials}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────

// Placeholder contatore notifiche — verrà collegato in F6.2
const NOTIFICHE_NON_LETTE = 0

export function Header() {
  const location = useLocation()
  const { id: praticaId } = useParams<{ id: string }>()
  const { userProfile } = useAuth()

  const crumbs = buildBreadcrumbs(location.pathname, praticaId)

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-4 border-b border-border bg-card px-6">

      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <nav className="flex flex-1 items-center gap-1.5 min-w-0">
        {crumbs.map((crumb, i) => (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <ChevronRight className="size-3.5 text-muted-foreground/50 flex-shrink-0" />
            )}
            {crumb.path ? (
              <Link
                to={crumb.path}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'text-sm truncate',
                  i === crumbs.length - 1
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {crumb.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* ── Ricerca globale (UI placeholder) ─────────────────────── */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 w-64">
        <Search className="size-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          placeholder="Cerca pratiche, clienti..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          readOnly
          title="Ricerca globale — disponibile nelle prossime versioni"
        />
        <kbd className="hidden text-[10px] text-muted-foreground/50 sm:inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
          ⌘K
        </kbd>
      </div>

      {/* ── Notifiche ─────────────────────────────────────────────── */}
      <button
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        title="Notifiche"
      >
        <Bell className="size-4" strokeWidth={1.5} />
        {NOTIFICHE_NON_LETTE > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {NOTIFICHE_NON_LETTE > 9 ? '9+' : NOTIFICHE_NON_LETTE}
          </span>
        )}
      </button>

      {/* ── Avatar utente ────────────────────────────────────────── */}
      {userProfile && (
        <div className="flex items-center gap-2">
          <MiniAvatar
            nome={userProfile.nome}
            cognome={userProfile.cognome}
            avatarUrl={userProfile.avatar_url}
          />
        </div>
      )}
    </header>
  )
}
