import { Toaster } from 'sonner'
import { useIsMobile } from '@/hooks/useIsMobile'

/**
 * Toast provider with responsive positioning.
 *
 * Requirements from plan:
 * - Position: top-right (desktop), top-center (mobile)
 * - Duration: 5 seconds
 * - Close button: always visible
 * - Style: matches Kuuki's Nordic Skies design system
 */
export function ToastProvider() {
  const isMobile = useIsMobile('sm')

  return (
    <Toaster
      position={isMobile ? 'top-center' : 'top-right'}
      duration={5000}
      closeButton
      offset={16}
      gap={8}
      toastOptions={{
        // Match Kuuki's design system
        className: 'font-sans',
        style: {
          // Use CSS variables from the design system
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          borderRadius: 'var(--radius)',
        },
        classNames: {
          toast:
            'group border-border/50 bg-card text-foreground shadow-lg',
          title: 'font-medium text-foreground',
          description: 'text-muted-foreground text-sm',
          actionButton:
            'bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm px-3 py-1.5 rounded-md',
          cancelButton:
            'bg-muted text-muted-foreground hover:bg-muted/80 font-medium text-sm px-3 py-1.5 rounded-md',
          closeButton:
            'bg-background border-border hover:bg-muted',
          error:
            'border-destructive/30 bg-destructive/5 text-destructive',
          success:
            'border-success/30 bg-success/5 text-success',
          warning:
            'border-warning/30 bg-warning/5 text-foreground',
          info: 'border-primary/30 bg-primary/5 text-foreground',
        },
      }}
    />
  )
}
