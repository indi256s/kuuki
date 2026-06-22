
import { useMemo } from 'react'
import { findAirline, getAirlineLogoUrl } from '@kuuki/data'
import { cn } from '@/lib/utils'
import { MAP_CSS_VARS } from '@/lib/mapColors'
import type { JourneyLeg } from '@/types/journey'
import { Plane, GripVertical, Clock } from 'lucide-react'

interface FlightGanttBlockProps {
    leg: JourneyLeg
    className?: string
}

export function FlightGanttBlock({ leg, className }: FlightGanttBlockProps) {
    const airline = useMemo(() => findAirline(leg.airline), [leg.airline])
    const airlineColor = airline?.primaryColor || MAP_CSS_VARS.routeFallback
    const logoUrl = getAirlineLogoUrl(leg.airline)

    return (
        <div
            className={cn(
                'group relative w-72 h-32 rounded-2xl overflow-hidden transition-all duration-300',
                'hover:scale-[1.02] hover:-translate-y-0.5',
                'active:scale-[0.98] cursor-grab active:cursor-grabbing',
                'bg-card border border-border',
                className
            )}
        >
            <div
                className="absolute top-0 left-0 right-0 h-1.5 w-full z-10"
                style={{ backgroundColor: airlineColor }}
            />

            <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent pointer-events-none" />

            <div className="relative h-full p-5 flex flex-col justify-between">

                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-background border border-border p-1 flex items-center justify-center overflow-hidden shrink-0">
                            <img
                                src={logoUrl}
                                alt={leg.airline}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.opacity = '0.5'
                                }}
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-wide leading-none">{leg.airline}</span>
                            <span className="text-xs text-muted-foreground font-mono mt-1">{leg.flightNumber}</span>
                        </div>
                    </div>

                    <button type="button" className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors -mr-2 -mt-2" aria-label="Reorder segment">
                        <GripVertical className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col items-start min-w-[3rem]">
                        <span className="text-2xl font-black tracking-tight">{leg.origin}</span>
                        <span className="text-[10px] uppercase text-muted-foreground font-medium tracking-wider">Dep</span>
                    </div>

                    <div className="flex-1 px-4 flex flex-col items-center justify-center relative">
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-border border-t border-dashed w-full" />
                        <div className="relative z-10 bg-card p-1 rounded-full border border-border">
                            <Plane className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
                        </div>
                    </div>

                    <div className="flex flex-col items-end min-w-[3rem]">
                        <span className="text-2xl font-black tracking-tight">{leg.destination}</span>
                        <span className="text-[10px] uppercase text-muted-foreground font-medium tracking-wider">Arr</span>
                    </div>
                </div>

                <div className="mt-auto pt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground border-t border-border">
                    <Clock className="w-3 h-3" />
                    <span>{leg.duration}</span>
                </div>
            </div>
        </div>
    )
}
