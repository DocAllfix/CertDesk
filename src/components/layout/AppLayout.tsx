import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

/**
 * AppLayout — wrapper principale dell'app autenticata.
 *
 * Struttura:
 *   ┌────────────────────────────────────────┐
 *   │  Sidebar (240px, fixed height)         │
 *   │  ┌──────────────────────────────────┐  │
 *   │  │  Header (56px, top bar)          │  │
 *   │  ├──────────────────────────────────┤  │
 *   │  │  <Outlet /> (contenuto pagina)   │  │
 *   │  └──────────────────────────────────┘  │
 *   └────────────────────────────────────────┘
 *
 * Nota: Header usa useParams() — funziona perché AppLayout è
 * renderizzato come route element, quindi il context delle route
 * figle è già disponibile tramite Outlet.
 */
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
