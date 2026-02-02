import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plane, Calendar, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatDuration } from '@/lib/formatDuration'
import type { Flight } from '@/lib/flights'

interface FlightPopoverProps {
  flightId: number | null
  children: React.ReactNode
  className?: string
}

/**
 * Popover that shows flight details on hover
 * Used for longest/shortest flight stats in Time Geek tier
 */
export function FlightPopover({ flightId, children, className }: FlightPopoverProps) {
  const [open, setOpen] = useState(false)

  const { data: flight, isLoading } = useQuery({
    queryKey: ['flight-popover', flightId],
    queryFn: async (): Promise<Flight | null> => {
      if (flightId === null) return null

      const { data, error } = await supabase
        .from('flights')
        .select('*')
        .eq('id', flightId)
        .single()

      if (error) throw error
      return data
    },
    enabled: open && flightId !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (flightId === null) {
    return <>{children}</>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 hover:underline underline-offset-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'cursor-pointer transition-colors',
            className
          )}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {isLoading ? (
          <FlightPopoverSkeleton />
        ) : flight ? (
          <FlightPopoverContent flight={flight} />
        ) : (
          <p className="text-sm text-muted-foreground">Flight not found</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function FlightPopoverContent({ flight }: { flight: Flight }) {
  const formattedDate = flight.date
    ? new Date(flight.date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown date'

  return (
    <div className="space-y-2">
      {/* Route */}
      <div className="flex items-center gap-2">
        <Plane className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-1.5 font-mono font-medium">
          <span>{flight.origin || '???'}</span>
          <span className="text-muted-foreground">→</span>
          <span>{flight.destination || '???'}</span>
        </div>
        {flight.flight_number && (
          <span className="text-xs text-muted-foreground ml-auto">
            {flight.flight_number}
          </span>
        )}
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4 shrink-0" />
        <span>{formattedDate}</span>
      </div>

      {/* Duration */}
      {flight.duration_minutes && flight.duration_minutes > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4 shrink-0" />
          <span>{formatDuration(flight.duration_minutes)}</span>
        </div>
      )}

      {/* Aircraft */}
      {flight.aircraft_icao && (
        <div className="pt-1 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            Aircraft: <span className="font-mono">{flight.aircraft_icao}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function FlightPopoverSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded" />
      </div>
    </div>
  )
}
