import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
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
import { AlertCircle, Mail, Lock } from 'lucide-react'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onSuccess?: () => void
  onSignInClick?: () => void
}

/**
 * Streamlined registration form (open registration).
 *
 * Key differences from SignUpForm:
 * - No password confirmation field (reduces friction)
 * - Icons in form fields for visual polish
 */
export function RegisterForm({ onSuccess, onSignInClick }: RegisterFormProps) {
  const { t } = useTranslation()
  const { signUp, isLoading } = useAuth()

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: RegisterFormData) => {
    form.clearErrors('root')

    const result = await signUp(data.email, data.password)

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

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-foreground/80">{t('auth.email', 'Email')}</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  disabled={isLoading}
                  className="h-12 aura-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground placeholder:text-muted-foreground"
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
                <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-foreground/80">{t('auth.password', 'Password')}</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="h-12 aura-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground placeholder:text-muted-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 aura-button rounded-xl text-primary-foreground font-medium text-base border-0"
        >
          {isLoading ? t('common.loading') : t('auth.createAccount')}
        </Button>

        {onSignInClick && (
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.haveAccount', 'Already have an account?')}{' '}
            <button
              type="button"
              onClick={onSignInClick}
              className="text-primary hover:opacity-80 transition-opacity font-medium ml-1 hover:underline underline-offset-4"
            >
              {t('auth.signIn')}
            </button>
          </p>
        )}
      </form>
    </Form>
  )
}
