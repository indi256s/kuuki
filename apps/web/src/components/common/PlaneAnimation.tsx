import { useMemo } from 'react'
import { Plane } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PlaneAnimationProps {
    /** Additional classes for the container */
    className?: string
    /** Number of planes to generate */
    count?: number
    /** Visual style of the planes */
    variant?: 'subtle' | 'default' | 'vibrant'
}

type PlaneSize = 'S' | 'M' | 'L'

interface PlaneConfig {
    left: string
    duration: number
    delay: number
    opacity: number
    size: number
}

// Size groups configuration
const sizeConfig: Record<PlaneSize, { size: number; opacity: number }> = {
    S: { size: 12, opacity: 0.25 },
    M: { size: 16, opacity: 0.35 },
    L: { size: 22, opacity: 0.45 },
}

export function PlaneAnimation({
    className,
    count = 30,
    variant = 'default'
}: PlaneAnimationProps) {

    // Memoize plane generation to avoid recalculating on re-renders
    const planes = useMemo(() => {
        // Distribute planes across size groups
        const sCount = Math.floor(count * 0.4) // 40% small
        const mCount = Math.floor(count * 0.35) // 35% medium
        const lCount = count - sCount - mCount // Remainder large

        const sizeDistribution: PlaneSize[] = [
            ...Array(sCount).fill('S' as PlaneSize),
            ...Array(mCount).fill('M' as PlaneSize),
            ...Array(lCount).fill('L' as PlaneSize),
        ]

        return sizeDistribution.map((sizeGroup, i) => {
            const { size, opacity } = sizeConfig[sizeGroup]

            // Adjust opacity based on variant
            let finalOpacity = opacity
            if (variant === 'subtle') finalOpacity *= 0.6
            if (variant === 'vibrant') finalOpacity *= 1.3

            return {
                left: `${(i * (100 / count) + Math.random() * 5) % 100}%`,
                duration: 10 + Math.random() * 15, // 10-25s duration
                delay: Math.random() * 20, // 0-20s delay
                opacity: Math.min(finalOpacity + Math.random() * 0.08, 1),
                size,
            } as PlaneConfig
        })
    }, [count, variant])

    return (
        <div className={cn("absolute inset-0 overflow-hidden pointer-events-none z-[1]", className)}>
            {planes.map((plane, i) => (
                <Plane
                    key={i}
                    className="absolute text-primary animate-plane-ascend"
                    style={{
                        left: plane.left,
                        width: plane.size,
                        height: plane.size,
                        // Custom properties for CSS animation
                        ['--plane-duration' as string]: `${plane.duration}s`,
                        ['--plane-delay' as string]: `${plane.delay}s`,
                        ['--plane-opacity' as string]: plane.opacity,
                    }}
                    strokeWidth={1.5}
                />
            ))}
        </div>
    )
}
