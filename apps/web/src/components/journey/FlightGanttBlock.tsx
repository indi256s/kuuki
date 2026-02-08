
import { useMemo } from 'react'
import { findAirline, getAirlineLogoUrl } from '@kuuki/data'
import { cn } from '@/lib/utils'
import type { JourneyLeg } from '@/routes/JourneyPlannerPage'
import { Plane, GripVertical, Clock } from 'lucide-react'

interface FlightGanttBlockProps {
    leg: JourneyLeg
    className?: string
}

export function FlightGanttBlock({ leg, className }: FlightGanttBlockProps) {
    const airline = useMemo(() => findAirline(leg.airline), [leg.airline])
    const airlineColor = airline?.primaryColor || '#3b82f6'
    const logoUrl = getAirlineLogoUrl(leg.airline)

    return (
        <div
            className={cn(
                'group relative w-72 h-32 rounded-2xl overflow-hidden transition-all duration-300',
                'hover:scale-[1.02] hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50',
                'active:scale-[0.98] cursor-grab active:cursor-grabbing',
                'bg-[#0f172a] border border-white/5',
                className
            )}
        >
            {/* Airline Color Accent Bar (Top) */}
            <div
                className="absolute top-0 left-0 right-0 h-1.5 w-full z-10"
                style={{ backgroundColor: airlineColor, boxShadow: `0 0 15px ${airlineColor}80` }}
            />

            {/* Background Texture - subtle noise/gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

            <div className="relative h-full p-5 flex flex-col justify-between">

                {/* Top Row: Airline Info & Grip */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
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
                            <span className="text-white font-bold text-sm tracking-wide leading-none">{leg.airline}</span>
                            <span className="text-xs text-white/40 font-mono mt-1">{leg.flightNumber}</span>
                        </div>
                    </div>

                    <button className="text-white/20 hover:text-white/60 transition-colors p-1 -mr-2 -mt-2">
                        <GripVertical className="w-4 h-4" />
                    </button>
                </div>

                {/* Middle Row: Route Visualization */}
                <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col items-start min-w-[3rem]">
                        <span className="text-2xl font-black text-white tracking-tight">{leg.origin}</span>
                        <span className="text-[10px] uppercase text-white/40 font-medium tracking-wider">Dep</span>
                    </div>

                    {/* Flight Path Graphic */}
                    <div className="flex-1 px-4 flex flex-col items-center justify-center relative">
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 border-t border-dashed border-white/20 w-full" />
                        <div className="relative z-10 bg-[#0f172a] p-1 rounded-full border border-white/5">
                            <Plane className="w-3.5 h-3.5 text-white/60 rotate-90" />
                        </div>
                    </div>

                    <div className="flex flex-col items-end min-w-[3rem]">
                        <span className="text-2xl font-black text-white tracking-tight">{leg.destination}</span>
                        <span className="text-[10px] uppercase text-white/40 font-medium tracking-wider">Arr</span>
                    </div>
                </div>

                {/* Bottom Row: Duration */}
                <div className="mt-auto pt-3 flex items-center gap-1.5 text-xs font-medium text-white/50 border-t border-white/5">
                    <Clock className="w-3 h-3" />
                    <span>{leg.duration}</span>
                </div>
            </div>
        </div>
    )
}
