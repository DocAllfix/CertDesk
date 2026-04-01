import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/hooks/useAuth'
import LoginPage from '@/pages/auth/LoginPage'
import ClientiPage from '@/pages/database/ClientiPage'
import ConsulentiPage from '@/pages/database/ConsulentiPage'
import PratichePage from '@/pages/pratiche/PratichePage'
import PraticaDettaglioPage from '@/pages/pratiche/PraticaDettaglioPage'

// ── QueryClient ──────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

// ── Placeholder pagine — sostituiti nelle fasi F3–F11 ────────────

function Placeholder({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-2">
      <p className="text-base font-semibold text-foreground">{name}</p>
      <p className="text-sm text-muted-foreground">Implementazione in corso...</p>
    </div>
  )
}

// ── Protected Layout ─────────────────────────────────────────────
// Usa Outlet: rende i children solo se autenticato, altrimenti
// rimanda a /login. Sostituisce il vecchio wrapper con children.

function ProtectedLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

// ── App ──────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>

            {/* ── Route pubblica ──────────────────────────────── */}
            <Route path="/login" element={<LoginPage />} />

            {/* ── Route protette con layout completo ──────────── */}
            <Route element={<ProtectedLayout />}>
              <Route element={<AppLayout />}>

                {/* Redirect root → dashboard */}
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* Pagine principali */}
                <Route path="dashboard" element={<Placeholder name="DashboardPage" />} />
                <Route path="pratiche" element={<PratichePage />} />
                <Route path="pratiche/:id" element={<PraticaDettaglioPage />} />
                <Route path="pipeline" element={<Placeholder name="PipelinePage (Kanban)" />} />
                <Route path="scadenze" element={<Placeholder name="ScadenzePage" />} />

                {/* Database */}
                <Route path="database/clienti" element={<ClientiPage />} />
                <Route path="database/consulenti" element={<ConsulentiPage />} />
                <Route path="database/archivio" element={<Placeholder name="ArchivioPratiche" />} />
                <Route path="promemoria" element={<Placeholder name="PromemoriaPage" />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />

              </Route>
            </Route>

          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
