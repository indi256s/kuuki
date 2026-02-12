import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  size = "md",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  size?: "sm" | "md" | "lg" | "xl" | "full"
  showCloseButton?: boolean
}) {
  // Keyboard height detection for bottom sheets
  const keyboardHeight = useKeyboardHeight()

  // Size classes for left/right sheets - progressive widths for large screens
  const sizeClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-sm lg:max-w-md xl:max-w-lg 3xl:max-w-xl 4xl:max-w-2xl",
    lg: "sm:max-w-md lg:max-w-lg xl:max-w-xl 3xl:max-w-2xl 4xl:max-w-3xl",
    xl: "sm:max-w-lg lg:max-w-xl xl:max-w-2xl 3xl:max-w-3xl 4xl:max-w-4xl",
    full: "sm:max-w-xl lg:max-w-2xl xl:max-w-3xl 3xl:max-w-4xl 4xl:max-w-5xl",
  }

  // For bottom sheets: dynamically adjust position and max-height when keyboard opens.
  // `bottom` offset moves the sheet above the keyboard (needed for iOS Safari where
  // interactive-widget=resizes-content isn't supported). On Chromium, the viewport
  // meta tag handles repositioning and keyboardHeight stays 0, so this is a no-op.
  const bottomSheetStyle: React.CSSProperties | undefined =
    side === "bottom"
      ? {
          maxHeight: keyboardHeight > 0
            ? `calc(100vh - ${keyboardHeight}px - env(safe-area-inset-top, 0px))`
            : '85vh',
          bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
          transition: 'bottom 0.15s ease-out, max-height 0.15s ease-out',
        }
      : undefined

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            `data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l ${sizeClasses[size]}`,
          side === "left" &&
            `data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r ${sizeClasses[size]}`,
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 border-t rounded-t-2xl overflow-y-auto",
          className
        )}
        style={bottomSheetStyle}
        {...props}
      >
        {/* Drag handle for bottom sheets */}
        {side === "bottom" && (
          <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-background z-10">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        {children}
        {showCloseButton && side !== "bottom" && (
          <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 lg:top-6 lg:right-6 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4 lg:p-6 xl:p-8", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4 lg:p-6 xl:p-8", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
