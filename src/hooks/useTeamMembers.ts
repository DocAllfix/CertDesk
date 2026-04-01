/**
 * Hook TanStack Query per caricare gli utenti interni attivi.
 * Usato nei select assegnato_a e auditor_id del form pratiche.
 */
import { useQuery } from '@tanstack/react-query'
import { getTeamMembers } from '@/lib/queries/userProfiles'

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team_members'],
    queryFn:  getTeamMembers,
    staleTime: 1000 * 60 * 10, // 10 minuti — gli utenti cambiano raramente
  })
}
