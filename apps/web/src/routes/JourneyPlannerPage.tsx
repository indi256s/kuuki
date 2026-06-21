
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
    duration: string
}

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
        <div id="main-content" className="relative h-screen w-full flex flex-col bg-background text-foreground overflow-hidden font-sans">

            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />

            <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <Link to="/dashboard">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>

                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                            <MapIcon className="w-4 h-4 text-primary" />
                            Journey Planner
                        </h1>
                        <span className="text-xs text-muted-foreground font-mono tracking-wider">TBS • NRT</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="h-8 px-3 rounded-full bg-muted border border-border flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Oct 24 — Nov 12</span>
                    </div>

                    <Button size="sm" variant="outline">
                        <Save className="w-4 h-4 mr-2" />
                        Save Trip
                    </Button>
                </div>
            </header>

            <div className="flex-1 w-full h-full relative z-0">
                <JourneyMap legs={trip} />

                <div className="absolute bottom-48 right-6 flex flex-col gap-2 z-10">
                    <Button variant="outline" size="icon" className="h-11 w-11 rounded-full bg-card border-border">
                        <Plus className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="relative z-30 h-80 shrink-0">
                <div className="h-full bg-card border-t border-border flex flex-col">
                    <div className="px-6 py-3 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Timeline</h2>
                            <div className="h-4 w-px bg-border" />
                            <span className="text-xs text-muted-foreground font-mono">Total Duration: <span className="text-foreground">13h 05m</span></span>
                        </div>

                        <Button size="sm" variant="ghost" className="h-9 text-xs">
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
