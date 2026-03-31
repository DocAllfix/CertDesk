import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserProfile, UserRole } from '@/types/app.types'

// ── Tipo del Context ─────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null
  userProfile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean
  isResponsabile: boolean
  errorAccount: string | null
  logout: () => Promise<void>
}

// ── Creazione Context ────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null)

// ── Hook interno per consumare il context ────────────────────────
// Esportato qui per comodità — useAuth.ts fa re-export con guard

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthContext deve essere usato dentro <AuthProvider>')
  }
  return ctx
}

// ── Helper ruoli ─────────────────────────────────────────────────

function computeRuoli(ruolo: UserRole | undefined) {
  return {
    isAdmin: ruolo === 'admin',
    isResponsabile: ruolo === 'admin' || ruolo === 'responsabile',
  }
}

// ── AuthProvider ─────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorAccount, setErrorAccount] = useState<string | null>(null)

  // Carica il profilo utente dopo il login.
  // Null-safe: se il profilo non esiste o l'utente è disattivato → signOut.
  const loadUserProfile = useCallback(async (authUser: User) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error || !data) {
      setErrorAccount('Profilo utente non trovato. Contatta l\'amministratore.')
      await supabase.auth.signOut()
      return
    }

    if (!data.attivo) {
      setErrorAccount('Account disattivato. Contatta l\'amministratore.')
      await supabase.auth.signOut()
      return
    }

    setUserProfile(data)
    setErrorAccount(null)
  }, [])

  useEffect(() => {
    // 1. Carica sessione iniziale (evita flash di redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)

      if (authUser) {
        loadUserProfile(authUser).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    // 2. Sottoscrizione ai cambi di stato auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const authUser = session?.user ?? null
        setUser(authUser)

        if (event === 'SIGNED_OUT') {
          setUserProfile(null)
          setErrorAccount(null)
          setIsLoading(false)
          return
        }

        if (authUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          setIsLoading(true)
          loadUserProfile(authUser).finally(() => setIsLoading(false))
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUserProfile])

  const logout = useCallback(async () => {
    setIsLoading(true)
    await supabase.auth.signOut()
    // onAuthStateChange gestirà il reset dello stato
  }, [])

  const { isAdmin, isResponsabile } = computeRuoli(userProfile?.ruolo)

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isLoading,
        isAdmin,
        isResponsabile,
        errorAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
