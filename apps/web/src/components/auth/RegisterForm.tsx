import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { checkInviteCode } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { AlertCircle, Check, Ticket, Mail, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

const registerSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onSuccess?: () => void
  onSignInClick?: () => void
}

/**
 * Streamlined registration form for invite-only access.
 *
 * Key differences from SignUpForm:
 * - No password confirmation field (reduces friction)
 * - Invite code field is prominent and validated first
 * - Visual feedback on code validation (checkmark/error)
 * - Icons in form fields for visual polish
 */
export function RegisterForm({ onSuccess, onSignInClick }: RegisterFormProps) {
  const { t } = useTranslation()
  const { signUp, isLoading } = useAuth()
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [codeValid, setCodeValid] = useState<boolean | null>(null)

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      inviteCode: '',
      email: '',
      password: '',
    },
  })

  // Validate invite code on blur
  const handleCodeBlur = async () => {
    const inviteCode = form.getValues('inviteCode')
    if (!inviteCode.trim()) {
      setCodeValid(null)
      return
    }

    setIsCheckingCode(true)
    const valid = await checkInviteCode(inviteCode)
    setCodeValid(valid)
    setIsCheckingCode(false)
  }

  const onSubmit = async (data: RegisterFormData) => {
    form.clearErrors('root')

    const result = await signUp(data.email, data.password, data.inviteCode)

    if (result.success) {
      onSuccess?.()
    } else {
      form.setError('root', {
        message: result.error || t('errors.generic'),
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}

        {/* Closed Beta Badge - Linear style: airy, subtle */}
        <div className="flex justify-center mb-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium tracking-wide text-white/60 bg-white/[0.04] border border-white/[0.08]">
            Closed Beta
          </span>
        </div>

        {/* Invite Code - The gate to the community */}
        <FormField
          control={form.control}
          name="inviteCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-white/50" />
                <span className="text-white/80">{t('auth.inviteCode', 'Invite Code')}</span>
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="KUUKI-XXXX-XXXX"
                    disabled={isLoading}
                    className={cn(
                      'h-12 pl-3 font-mono text-lg uppercase tracking-wider pr-10 aura-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-white placeholder:text-white/20',
                      codeValid === true && 'border-success/50 focus-visible:ring-success/50',
                      codeValid === false && 'border-destructive/50 focus-visible:ring-destructive/50'
                    )}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value.toUpperCase())
                      setCodeValid(null)
                    }}
                    onBlur={() => {
                      field.onBlur()
                      handleCodeBlur()
                    }}
                  />
                  {/* Validation indicator */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingCode && (
                      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                    {codeValid === true && (
                      <Check className="w-4 h-4 text-success" />
                    )}
                    {codeValid === false && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </div>
              </FormControl>
              {codeValid === true && (
                <p className="text-xs text-success">
                  {t('auth.codeValid', 'Valid invite code')}
                </p>
              )}
              {codeValid === false && (
                <p className="text-xs text-destructive">
                  {t('auth.codeInvalid', 'Invalid or expired invite code')}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-white/50" />
                <span className="text-white/80">{t('auth.email', 'Email')}</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  disabled={isLoading}
                  className="h-12 aura-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-white placeholder:text-white/20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password - no confirmation needed */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-white/50" />
                <span className="text-white/80">{t('auth.password', 'Password')}</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="h-12 aura-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-white placeholder:text-white/20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isLoading || codeValid === false}
          className="w-full h-12 aura-button rounded-xl text-white font-medium text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 border-0"
        >
          {isLoading ? t('common.loading') : t('auth.createAccount')}
        </Button>

        {onSignInClick && (
          <p className="text-center text-sm text-white/50">
            {t('auth.haveAccount', 'Already have an account?')}{' '}
            <button
              type="button"
              onClick={onSignInClick}
              className="text-primary hover:text-primary-foreground transition-colors font-medium ml-1 hover:underline underline-offset-4"
            >
              {t('auth.signIn')}
            </button>
          </p>
        )}
      </form>
    </Form>
  )
}
