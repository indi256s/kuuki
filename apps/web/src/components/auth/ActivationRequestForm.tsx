import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { requestActivation } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ActivationRequestForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const result = await requestActivation(email.trim())
    setPending(false)
    if (result.success) setDone(true)
    else setError(result.error || t('auth.activationRequestFailed'))
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t('auth.activateTitle')}</h2>
      {done ? (
        <p role="status" className="text-sm text-muted-foreground">{t('auth.activationRequested')}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="activation-email" className="block text-sm font-medium">{t('auth.email')}</label>
          <Input id="activation-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">{pending ? t('common.loading') : t('auth.sendActivation')}</Button>
        </form>
      )}
      <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">{t('auth.backToSignIn')}</button>
    </div>
  )
}
