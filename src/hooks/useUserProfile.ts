/**
 * useUserProfile — TanStack Query per caricare/cachare il profilo utente.
 *
 * Uso alternativo a useAuth quando serve refetch esplicito o
 * stato di loading/error granulare per componenti specifici.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types/app.types'

export function useUserProfile(userId: string | undefined) {
  return useQuery<UserProfile | null>({
    queryKey: ['userProfile', userId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!userId) return null

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) return null

      return data
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minuti — il profilo cambia raramente
    gcTime: 1000 * 60 * 30,
  })
}
