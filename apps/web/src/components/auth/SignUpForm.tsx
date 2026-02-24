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
import { AlertCircle, CheckCircle2 } from 'lucide-react'

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

interface SignUpFormProps {
  onSuccess?: () => void
  onSignInClick?: () => void
}

export function SignUpForm({ onSuccess, onSignInClick }: SignUpFormProps) {
  const { t } = useTranslation()
  const { signUp, isLoading } = useAuth()
  const [inviteCodeStatus, setInviteCodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')

  const handleInviteCodeBlur = async (code: string) => {
    if (!code.trim()) {
      setInviteCodeStatus('idle')
      return
    }
    const isValid = await checkInviteCode(code)
    setInviteCodeStatus(isValid ? 'valid' : 'invalid')
  }

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
                  onChange={(e) => {
                    field.onChange(e.target.value.toUpperCase())
                    setInviteCodeStatus('idle')
                  }}
                  onBlur={() => handleInviteCodeBlur(field.value)}
                />
              </FormControl>
              {inviteCodeStatus === 'valid' && (
                <p className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('auth.codeValid', 'Valid invite code')}
                </p>
              )}
              {inviteCodeStatus === 'invalid' && (
                <p className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {t('auth.codeInvalid', 'Invalid or expired invite code')}
                </p>
              )}
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
