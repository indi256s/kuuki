import { PlaneAnimation } from '@/components/common/PlaneAnimation'
import { cn } from '@/lib/utils'

interface LoadingScreenProps {
    className?: string
    message?: string
}

export function LoadingScreen({ className, message = "Loading..." }: LoadingScreenProps) {
    return (
        <div className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center bg-background", className)}>
            {/* Background Animation */}
            <PlaneAnimation count={40} variant="vibrant" className="opacity-50" />

            <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">
                {/* Brand Mark with Pulse */}
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <span
                        className="relative text-6xl font-bold font-display select-none text-primary"
                        style={{
                            textShadow: '0 0 30px rgba(var(--primary), 0.3)'
                        }}
                    >
                        Kuuki
                        {/* Hiragana watermark overlay */}
                        <span className="absolute -top-6 -right-8 text-4xl text-primary/10 select-none pointer-events-none">
                            くうき
                        </span>
                    </span>
                </div>

                {/* Loading Message */}
                <p className="text-muted-foreground font-medium tracking-widest uppercase text-sm animate-pulse">
                    {message}
                </p>
            </div>
        </div>
    )
}
