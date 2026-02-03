import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { PlaneAnimation } from "@/components/common/PlaneAnimation"

// ----- Main Card Container -----
const atmosphericCardVariants = cva(
    "relative overflow-hidden border transition-all duration-300 group",
    {
        variants: {
            variant: {
                default: "bg-card text-card-foreground border-border/50 shadow-sm hover:shadow-md dark:hover:border-primary/20",
                glass: "bg-white/60 dark:bg-white/5 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20",
                ghost: "bg-transparent border-dashed border-border/50 text-muted-foreground hover:bg-muted/30",
            },
            size: {
                default: "rounded-[24px]",
                sm: "rounded-2xl",
                lg: "rounded-[32px]",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

interface AtmosphericCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof atmosphericCardVariants> {
    children: React.ReactNode
}

function AtmosphericCard({ className, variant, size, children, ...props }: AtmosphericCardProps) {
    return (
        <div className={cn(atmosphericCardVariants({ variant, size }), className)} {...props}>
            <div className="grid lg:grid-cols-[120px_1fr] h-full transition-all">
                {children}
            </div>
        </div>
    )
}

// ----- Left Visual Column -----
interface AtmosphericVisualProps extends React.HTMLAttributes<HTMLDivElement> {
    icon?: React.ReactNode
    showPlanes?: boolean
}

function AtmosphericVisual({ className, icon, showPlanes = true, children, ...props }: AtmosphericVisualProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden bg-neutral-100/50 dark:bg-transparent flex flex-col items-center justify-center p-6",
                // Separator line on desktop
                "lg:border-r lg:border-border/50",
                // Bottom border on mobile (since it stacks)
                "border-b border-border/50 lg:border-b-0",
                className
            )}
            {...props}
        >
            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 dark:from-primary/10 to-transparent opacity-80 dark:opacity-50 z-0" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] dark:opacity-20 z-0 mix-blend-overlay" />

            {/* Planes Animation (Optional) */}
            {showPlanes && (
                <PlaneAnimation
                    count={10}
                    variant="subtle"
                    className="opacity-50"
                />
            )}

            {/* Content (Icon/Badge) */}
            <div className="relative z-10 text-primary">
                {icon}
                {children}
            </div>

            {/* Hiragana Watermark (Subtle) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none select-none opacity-10">
                <span className="text-6xl font-bold font-display writing-vertical text-primary/30">
                    くうき
                </span>
            </div>
        </div>
    )
}

// ----- Right Content Column -----
function AtmosphericContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("p-6 flex flex-col justify-center", className)} {...props} />
    )
}

export { AtmosphericCard, AtmosphericVisual, AtmosphericContent }
