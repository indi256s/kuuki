
import { useState, useCallback } from 'react'
import { JourneyLeg } from '@/routes/JourneyPlannerPage'
import { FlightGanttBlock } from './FlightGanttBlock'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JourneyTimelineProps {
    legs: JourneyLeg[]
    onReorder: (legs: JourneyLeg[]) => void
}

export function JourneyTimeline({ legs, onReorder }: JourneyTimelineProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

    const handleDragStart = useCallback((index: number) => {
        setDraggedIndex(index)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return

        // Reorder logic
        const newLegs = [...legs]
        const [draggedItem] = newLegs.splice(draggedIndex, 1)
        newLegs.splice(index, 0, draggedItem)

        onReorder(newLegs)
        setDraggedIndex(index)
    }, [draggedIndex, legs, onReorder])

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null)
    }, [])

    return (
        <div className="flex items-center gap-0 h-full min-w-max pb-4 px-10">
            {legs.map((leg, index) => (
                <div
                    key={leg.id}
                    className={cn(
                        "relative flex items-center group transition-all duration-300",
                        draggedIndex === index ? "opacity-50 scale-95" : "opacity-100"
                    )}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                >

                    {/* Connector Line (Left) */}
                    {index > 0 && (
                        <div className="w-16 h-px bg-white/10 relative">
                            {/* Animated dot or arrow could go here */}
                            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/20" />
                        </div>
                    )}

                    {/* Wrap in a div to capture drag events cleanly if component doesn't forward ref/props */}
                    <div className="cursor-grab active:cursor-grabbing">
                        <FlightGanttBlock leg={leg} />
                    </div>
                </div>
            ))}

            {/* Connector to Add Button */}
            <div className="w-16 h-px bg-white/10 relative">
                <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/20" />
            </div>

            {/* Add Button Placeholder - Cinematic Style */}
            <button
                className={cn(
                    "w-20 h-20 rounded-full border border-dashed border-white/20 flex items-center justify-center",
                    "text-white/30 hover:text-white hover:border-white/50 hover:bg-white/5 transition-all duration-300",
                    "hover:scale-110 active:scale-95"
                )}
            >
                <Plus className="w-8 h-8" />
            </button>
        </div>
    )
}
