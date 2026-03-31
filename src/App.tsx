import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { useAuth } from '@/hooks/useAuth'
import LoginPage from '@/pages/auth/LoginPage'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

// ── QueryClient ──────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minuti
      retry: 1,
    },
  },
})

// ── Placeholder pagine — sostituiti nelle fasi F3–F11 ────────────

const Placeholder = ({ name }: { name: string }) => (
  <div className="flex flex-col gap-2 p-8 text-muted-foreground font-mono text-sm">
    <span className="text-foreground font-semibold">{name}</span>
    <span>Implementazione in corso...</span>
  </div>
)

// ── Protected Layout ─────────────────────────────────────────────
// Verrà sostituito da AppLayout (Sidebar + Header) in F2.4

function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // F2.4: qui verrà avvolto con <AppLayout>
  return <>{children}</>
}

// ── App ──────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Route pubblica */}
            <Route path="/login" element={<LoginPage />} />

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
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
