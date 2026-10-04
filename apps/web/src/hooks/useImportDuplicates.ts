import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'
import type { ExtractedFlight } from './useImport'

export function useImportDuplicates(flights: ExtractedFlight[]) {
  const userId = useAuthStore(state => state.user?.id)
  const candidates = flights.flatMap((flight, index) => {
    const { date, origin, destination } = flight
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date || !/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) return []
    return [{ index, date, origin, destination }]
  })
  return useQuery({
    queryKey: ['importDuplicates', userId, candidates],
    enabled: !!userId,
    queryFn: async () => {
      const duplicates = new Set<number>()
      for (let start = 0; start < candidates.length; start += 100) {
        const chunk = candidates.slice(start, start + 100)
        const result = await api.post<{ matches: { candidateIndex: number; flightId: number }[] }>(
          '/api/flights/duplicate-candidates', { candidates: chunk.map(({ date, origin, destination }) => ({ date, origin, destination })) },
        )
        for (const match of result.matches) duplicates.add(chunk[match.candidateIndex].index)
      }
      return duplicates
    },
    staleTime: 0,
  })
}
