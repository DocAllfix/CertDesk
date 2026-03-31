import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Placeholder components — sostituiti nelle fasi F2.2–F2.4
const Placeholder = ({ name }: { name: string }) => (
  <div style={{ padding: '2rem', color: '#94a3b8', fontFamily: 'monospace' }}>
    <h2>{name}</h2>
    <p>Implementazione in corso...</p>
  </div>
)

// Verrà sostituito da AuthProvider + useAuth in F2.3
const isAuthenticated = true

// Verrà sostituito da AppLayout in F2.4
const ProtectedLayout = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minuti
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Route pubblica */}
          <Route path="/login" element={<Placeholder name="LoginPage" />} />

          {/* Route protette */}
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <Navigate to="/dashboard" replace />
              </ProtectedLayout>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedLayout>
                <Placeholder name="DashboardPage" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/pratiche"
            element={
              <ProtectedLayout>
                <Placeholder name="PratichePage" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/pratiche/:id"
            element={
              <ProtectedLayout>
                <Placeholder name="PraticaDettaglioPage" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/pipeline"
            element={
              <ProtectedLayout>
                <Placeholder name="PipelinePage (Kanban)" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/scadenze"
            element={
              <ProtectedLayout>
                <Placeholder name="ScadenzePage" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/clienti"
            element={
              <ProtectedLayout>
                <Placeholder name="ClientiPage" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/consulenti"
            element={
              <ProtectedLayout>
                <Placeholder name="ConsulentiPage" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/archivio"
            element={
              <ProtectedLayout>
                <Placeholder name="ArchivioPratiche" />
              </ProtectedLayout>
            }
          />
          <Route
            path="/promemoria"
            element={
              <ProtectedLayout>
                <Placeholder name="PromemoriaPage" />
              </ProtectedLayout>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
