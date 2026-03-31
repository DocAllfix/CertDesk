import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { APP_CONFIG } from '@/config/app.config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Schema di validazione ────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email obbligatoria')
    .email('Inserisci un indirizzo email valido'),
  password: z
    .string()
    .min(1, 'Password obbligatoria'),
})

type LoginFormData = z.infer<typeof loginSchema>

// ── Mappa errori Supabase → italiano ─────────────────────────────

function mapErroreLogin(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Email o password non corretti. Verifica le tue credenziali.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Account non ancora attivato. Contatta l\'amministratore.'
  }
  if (message.includes('Too many requests') || message.includes('rate limit')) {
    return 'Troppi tentativi di accesso. Riprova tra qualche minuto.'
  }
  if (message.includes('User not found')) {
    return 'Nessun account trovato con questa email.'
  }
  return 'Errore durante l\'accesso. Riprova o contatta l\'amministratore.'
}

// ── Componente LoginPage ─────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate()
  const [errorLogin, setErrorLogin] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setErrorLogin(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setErrorLogin(mapErroreLogin(error.message))
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Pattern di sfondo sottile */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-card border border-border rounded-xl shadow-2xl p-8 space-y-8">

          {/* Header — Logo + titolo */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10 border border-primary/20">
              <Shield className="size-7 text-primary" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {APP_CONFIG.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestionale certificazioni ISO
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* Errore login globale */}
            {errorLogin && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                <p className="text-sm text-destructive font-medium">{errorLogin}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="nome@azienda.it"
                className={cn(
                  'bg-background border-border text-foreground placeholder:text-muted-foreground',
                  errors.email && 'border-destructive focus-visible:ring-destructive'
                )}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={cn(
                  'bg-background border-border text-foreground placeholder:text-muted-foreground',
                  errors.password && 'border-destructive focus-visible:ring-destructive'
                )}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Accesso in corso...
                </>
              ) : (
                'Accedi'
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            Sistema ad accesso riservato.{' '}
            <span className="text-muted-foreground/70">
              Per problemi di accesso contatta l'amministratore.
            </span>
          </p>
        </div>

        {/* Badge cliente sotto la card */}
        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          {APP_CONFIG.clienteName}
        </p>
      </div>
    </div>
  )
}
