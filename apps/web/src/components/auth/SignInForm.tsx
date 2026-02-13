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

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type SignInFormData = z.infer<typeof signInSchema>

interface SignInFormProps {
  onSuccess?: () => void
  onSignUpClick?: () => void
}

export function SignInForm({ onSuccess, onSignUpClick }: SignInFormProps) {
  const { t } = useTranslation()
  const { signIn, isLoading } = useAuth()

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: SignInFormData) => {
    form.clearErrors('root')

    const result = await signIn(data.email, data.password)

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
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isLoading}
                  className="h-12 aura-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="h-12 aura-input border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-foreground placeholder:text-muted-foreground/50"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full h-12 aura-button rounded-xl text-primary-foreground font-medium text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 border-0">
          {isLoading ? t('auth.signingIn') : t('auth.signIn')}
        </Button>

        {onSignUpClick && (
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.newUser')}{' '}
            <button
              type="button"
              onClick={onSignUpClick}
              className="text-primary hover:opacity-80 transition-opacity font-medium ml-1 hover:underline underline-offset-4"
            >
              {t('auth.createAccount')}
            </button>
          </p>
        )}
      </form>
    </Form>
  )
}
