import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getProcessingMessage } from '@/lib/glados-text'

interface LoadingScreenProps {
    className?: string
    message?: string
}

export function LoadingScreen({ className, message }: LoadingScreenProps) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const defaultMessage = useMemo(() => getProcessingMessage('generic'), [])
    const displayMessage = message ?? defaultMessage
    return (
        <div className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center bg-background", className)}>
            <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">
                {/* Brand Mark */}
                <div className="relative">
                    <span
                        className="relative text-6xl font-bold font-display select-none text-primary"
                    >
                        Kuuki
                        {/* Hiragana watermark overlay */}
                        <span className="absolute -top-6 -right-8 text-4xl text-primary/10 select-none pointer-events-none">
                            くうき
                        </span>
                    </span>
                </div>

                {/* Lightweight pulsing dots spinner */}
                <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite]" />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite]" />
                </div>

                {/* Loading Message */}
                <p className="text-muted-foreground font-medium tracking-widest uppercase text-sm animate-pulse">
                    {displayMessage}
                </p>
            </div>
        </div>
    )
}
