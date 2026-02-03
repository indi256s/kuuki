import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

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
            size: {
                default: "p-6",
                sm: "p-4",
                lg: "p-8",
            }
        },
        defaultVariants: {
            variant: "glass",
            size: "default",
        },
    }
)

const Note = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof noteVariants>
>(({ className, variant, size, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(noteVariants({ variant, size }), className)}
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
            "text-sm text-muted-foreground leading-relaxed",
            // Markdown-like styling similar to Raycast
            "[&_p]:mb-2 [&_p:last-child]:mb-0",
            "[&_strong]:font-medium [&_strong]:text-foreground",
            // List styling - The key to the Raycast look
            "[&_ul]:my-2 [&_ul]:pl-0 [&_ul]:list-none [&_ul]:space-y-2",
            // Custom bullet point override using primary color (Coral)
            "[&_li]:relative [&_li]:pl-5",
            "[&_li]:before:content-['•'] [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-0 [&_li]:before:text-primary [&_li]:before:font-bold",
            className
        )}
        {...props}
    />
))
NoteContent.displayName = "NoteContent"

export { Note, NoteHeader, NoteTitle, NoteContent }
