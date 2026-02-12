import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface FlightDuration {
  aircraft_icao: string
  duration_minutes: number
}

export function useFlightDurations() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['flightDurations', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flights')
        .select('aircraft_icao, duration_minutes')
        .eq('user_id', userId!)
        .not('aircraft_icao', 'is', null)
        .not('duration_minutes', 'is', null)
        .or('is_upcoming.is.null,is_upcoming.eq.false')
      if (error) throw error
      return (data ?? []) as FlightDuration[]
    },
    enabled: !!userId,
  })
}
