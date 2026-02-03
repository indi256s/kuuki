import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const noteVariants = cva(
    "relative w-full rounded-2xl border p-6 text-sm transition-all duration-200",
    {
        variants: {
            variant: {
                default: "bg-card text-card-foreground shadow-sm",
                glass: "bg-white/60 dark:bg-white/5 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20",
                ghost: "bg-transparent border-dashed text-muted-foreground hover:bg-muted/50",
                highlight: "bg-primary/5 border-primary/20 text-primary-foreground",
            },
            // Semantic accent variants with left border accent
            accent: {
                none: "",
                primary: "border-l-4 border-l-primary/60 bg-primary/[0.03] dark:bg-primary/[0.06]",
                info: "border-l-4 border-l-info/60 bg-info/[0.04] dark:bg-info/[0.08]",
                success: "border-l-4 border-l-success/60 bg-success/[0.04] dark:bg-success/[0.08]",
                warning: "border-l-4 border-l-warning/60 bg-warning/[0.04] dark:bg-warning/[0.08]",
                destructive: "border-l-4 border-l-destructive/60 bg-destructive/[0.04] dark:bg-destructive/[0.08]",
            },
            size: {
                default: "p-6",
                sm: "p-4",
                lg: "p-8",
            }
        },
        defaultVariants: {
            variant: "glass",
            accent: "none",
            size: "default",
        },
    }
)

const Note = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof noteVariants>
>(({ className, variant, accent, size, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(noteVariants({ variant, accent, size }), className)}
        {...props}
    />
))
Note.displayName = "Note"

const NoteHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 mb-3", className)}
        {...props}
    />
))
NoteHeader.displayName = "NoteHeader"

const NoteTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "font-display font-semibold leading-none tracking-tight text-foreground flex items-center gap-2",
            className
        )}
        {...props}
    />
))
NoteTitle.displayName = "NoteTitle"

const NoteContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            // Better contrast: foreground/85 instead of muted-foreground
            "text-sm text-foreground/85 dark:text-foreground/90 leading-relaxed",
            // Paragraph styling
            "[&_p]:mb-2.5 [&_p:last-child]:mb-0",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            // List styling with proper spacing
            "[&_ul]:my-3 [&_ul]:pl-0 [&_ul]:list-none [&_ul]:space-y-2.5",
            "[&_ol]:my-3 [&_ol]:pl-0 [&_ol]:list-none [&_ol]:space-y-2.5 [&_ol]:counter-reset-[item]",
            // Custom bullet styling - larger, colored dot with better alignment
            "[&_li]:relative [&_li]:pl-6 [&_li]:text-foreground/80 dark:[&_li]:text-foreground/85",
            "[&_ul_li]:before:content-[''] [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:top-[0.5em]",
            "[&_ul_li]:before:w-1.5 [&_ul_li]:before:h-1.5 [&_ul_li]:before:rounded-full",
            "[&_ul_li]:before:bg-primary/70 dark:[&_ul_li]:before:bg-primary/80",
            // Ordered list - numbered with accent color
            "[&_ol_li]:before:counter-increment-[item] [&_ol_li]:before:content-[counter(item)'.']",
            "[&_ol_li]:before:absolute [&_ol_li]:before:left-0 [&_ol_li]:before:top-0",
            "[&_ol_li]:before:font-mono [&_ol_li]:before:text-xs [&_ol_li]:before:font-semibold",
            "[&_ol_li]:before:text-primary/80 dark:[&_ol_li]:before:text-primary/90",
            // Nested list indentation
            "[&_li_ul]:mt-2 [&_li_ol]:mt-2",
            className
        )}
        {...props}
    />
))
NoteContent.displayName = "NoteContent"

export { Note, NoteHeader, NoteTitle, NoteContent }
