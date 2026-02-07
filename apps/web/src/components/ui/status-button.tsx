import * as React from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type StatusButtonStatus = 'idle' | 'loading' | 'success' | 'error'

interface StatusButtonProps extends React.ComponentProps<typeof Button> {
  status?: StatusButtonStatus
  idleText: string
  loadingText?: string
  successText?: string
  errorText?: string
}

function StatusButton({
  status = 'idle',
  idleText,
  loadingText = idleText,
  successText = idleText,
  errorText = idleText,
  disabled,
  className,
  ...props
}: StatusButtonProps) {
  const isDisabled = disabled || status === 'loading' || status === 'success'

  const icon = {
    idle: null,
    loading: <Loader2 className="size-4 animate-spin" />,
    success: <Check className="size-4 animate-status-pop" />,
    error: <AlertCircle className="size-4 animate-status-pop" />,
  }[status]

  const text = {
    idle: idleText,
    loading: loadingText,
    success: successText,
    error: errorText,
  }[status]

  return (
    <Button
      disabled={isDisabled}
      className={cn(
        'gap-2 transition-colors',
        status === 'success' && 'bg-success text-success-foreground hover:bg-success/90',
        status === 'error' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="animate-fade-in">{text}</span>
    </Button>
  )
}

export { StatusButton }
export type { StatusButtonProps, StatusButtonStatus }
