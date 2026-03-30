import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variabili VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY obbligatorie in .env.local'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

// ── Type helpers ────────────────────────────────────────────────
// Uso: Tables<'pratiche'> → tipo Row della tabella pratiche
//      Inserts<'pratiche'> → tipo Insert della tabella pratiche
//      Updates<'pratiche'> → tipo Update della tabella pratiche

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// ── Enum helpers ────────────────────────────────────────────────
// Uso: DbEnum<'user_role'> → 'admin' | 'responsabile' | 'operatore'

export type DbEnum<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
