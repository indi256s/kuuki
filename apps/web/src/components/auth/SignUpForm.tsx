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
import { AlertCircle } from 'lucide-react'

const signUpSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SignUpFormData = z.infer<typeof signUpSchema>

const AUTH_ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'errors.auth.invalidCredentials',
  'Email not confirmed': 'errors.auth.emailNotConfirmed',
  'User already registered': 'errors.auth.emailTaken',
  'Password should be at least 6 characters': 'errors.auth.passwordTooShort',
  'Invalid invite code': 'errors.auth.invalidInvite',
  'invalid_invite_code': 'errors.auth.invalidInvite',
}

function mapAuthError(error: string): string {
  for (const [pattern, key] of Object.entries(AUTH_ERROR_MAP)) {
    if (error.includes(pattern)) return key
  }
  return ''
}

interface SignUpFormProps {
  onSuccess?: () => void
  onSignInClick?: () => void
}

export function SignUpForm({ onSuccess, onSignInClick }: SignUpFormProps) {
  const { t } = useTranslation()
  const { signUp, isLoading } = useAuth()

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      inviteCode: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: SignUpFormData) => {
    form.clearErrors('root')

    const result = await signUp(data.email, data.password, data.inviteCode)

    if (result.success) {
      onSuccess?.()
    } else {
      const errorKey = result.error ? mapAuthError(result.error) : ''
      form.setError('root', {
        message: errorKey ? t(errorKey) : t('errors.generic.1'),
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
          name="inviteCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.inviteCode', 'Invite Code')}</FormLabel>
              <FormControl>
                <Input
                  placeholder="KUUKI-XXXX-word-word"
                  disabled={isLoading}
                  className="font-mono text-sm"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.email', 'Email')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  disabled={isLoading}
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
              <FormLabel>{t('auth.password', 'Password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.confirmPassword', 'Confirm Password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? t('common.loading') : t('auth.createAccount')}
        </Button>

        {onSignInClick && (
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.haveAccount', 'Already have an account?')}{' '}
            <button
              type="button"
              onClick={onSignInClick}
              className="text-primary hover:underline"
            >
              {t('auth.signIn')}
            </button>
          </p>
        )}
      </form>
    </Form>
  )
}
