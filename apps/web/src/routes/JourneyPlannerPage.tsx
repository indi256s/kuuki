
import { useState } from 'react'
import { JourneyMap } from '@/components/journey/JourneyMap'
import { JourneyTimeline } from '@/components/journey/JourneyTimeline'
import { Button } from '@/components/ui/button'
import { Plus, Save, Map as MapIcon, Calendar, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface JourneyLeg {
    id: string
    origin: string
    destination: string
    airline: string
    flightNumber: string
    duration: string // "3h 40m"
}

// Mock initial data: Tbilisi -> Doha -> Tokyo
const INITIAL_TRIP: JourneyLeg[] = [
    {
        id: 'leg-1',
        origin: 'TBS',
        destination: 'DOH',
        airline: 'QR',
        flightNumber: 'QR256',
        duration: '3h 10m',
    },
    {
        id: 'leg-2',
        origin: 'DOH',
        destination: 'NRT',
        airline: 'QR',
        flightNumber: 'QR806',
        duration: '9h 55m',
    },
]

export function JourneyPlannerPage() {
    const [trip, setTrip] = useState<JourneyLeg[]>(INITIAL_TRIP)

    return (
        <div className="relative h-screen w-full flex flex-col bg-[#020617] text-white overflow-hidden font-sans selection:bg-indigo-500/30">

            {/* Cinematic Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020617] to-[#020617] pointer-events-none" />

            {/* Header - Floating Glass */}
            <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <Link to="/dashboard">
                        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>

                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-indigo-400" />
                            Journey Planner
                        </h1>
                        <span className="text-xs text-white/50 font-mono tracking-wider">TBS • NRT</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="h-8 px-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-2 text-xs font-medium text-white/70">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Oct 24 — Nov 12</span>
                    </div>

                    <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md shadow-xl transition-all hover:scale-105">
                        <Save className="w-4 h-4 mr-2" />
                        Save Trip
                    </Button>
                </div>
            </header>

            {/* Main Map Area */}
            <div className="flex-1 w-full h-full relative z-0">
                <JourneyMap legs={trip} />

                {/* Map Controls Overlay (Mock) */}
                <div className="absolute bottom-48 right-6 flex flex-col gap-2 z-10">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-black/40 border-white/10 text-white hover:bg-black/60 backdrop-blur-md">
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Bottom Timeline Drawer - Glassmorphism */}
            <div className="relative z-30 h-80 shrink-0">
                {/* Glass Gradient Border Top */}
                <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="h-full bg-black/40 backdrop-blur-xl border-t border-white/5 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                    <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Timeline</h2>
                            <div className="h-4 w-px bg-white/10" />
                            <span className="text-xs text-white/60 font-mono">Total Duration: <span className="text-white">13h 05m</span></span>
                        </div>

                        <Button size="sm" variant="ghost" className="h-7 text-xs text-white/70 hover:text-white hover:bg-white/5">
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Segment
                        </Button>
                    </div>

                    <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 w-full custom-scrollbar">
                        <JourneyTimeline legs={trip} onReorder={setTrip} />
                    </div>
                </div>
            </div>
        </div>
    )
}
