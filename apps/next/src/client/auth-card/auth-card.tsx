'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@kuuki/client/apiClient'
import { withIdentityMutation } from '../activity'
import type { Locale } from '../../lib/format'
import { BrandPanel } from './brand-panel'
import { CornerControls } from './corner-controls'
import { FormStep } from './form-step'
import { Tagline } from './taglines'
import './auth-card.css'

/**
 * The card's static frame: brand panel (left on desktop, the band above the sheet on mobile), corner controls, and the
 * form panel holding `children`. Shared by every auth surface so the top stays put while the content changes.
 */
export function AuthCardFrame({ locale, brandField, theme, children }: { locale: Locale; brandField?: ReactNode; theme?: ReactNode; children: ReactNode }) {
  return <div className="auth-card">
    <BrandPanel field={brandField} />
    <CornerControls locale={locale} theme={theme} />
    <section className="auth-form-panel"><div className="auth-column">{children}</div></section>
  </div>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The card's states (spec "Client state machine"). Ticket 08 adds `request`, `sending` and `sent`.
 * `form` also carries `taken` (409 from Create account) and the `created` notice (account made, session not issued),
 * and client-side `email` / `password` validation, which the spec's shorter list leaves implicit.
 */
export type CardState =
  | { step: 'form'; error?: 'email' | 'password' | 'invalid' | 'rate' | 'network' | 'taken'; notice?: 'created' }
  | { step: 'checking' }
  | { step: 'create'; email: string; error?: 'short' | 'rate' | 'network' }
  | { step: 'creating'; email: string }

/** Where focus goes after a state change. The heading is the default; the create step and Change are the exceptions. */
type FocusTarget = 'heading' | 'primary' | 'email-selected' | 'email' | 'password' | 'none'

/** Continue answered `{ next: 'create' }`: no session was issued, so the identity mutation must not navigate. */
class NoJournal extends Error {}

const codeOf = (error: unknown) => error instanceof ApiError ? error.code : undefined
const statusOf = (error: unknown) => error instanceof ApiError ? error.status : undefined

/**
 * The one-form auth card. Continue posts to `/api/auth/continue`: a session lands in the journal, a wrong password
 * stays on the form with an error, and an unknown email turns the card into the create step in place.
 */
export function AuthCard({ locale, initialEmail = '', tagline }: { locale: Locale; initialEmail?: string; tagline: number }) {
  const router = useRouter()
  const [state, setState] = useState<CardState>({ step: 'form' })
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const focus = useRef<FocusTarget>('none')
  const heading = useRef<HTMLHeadingElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const primary = useRef<HTMLButtonElement>(null)

  const go = (next: CardState, target: FocusTarget = 'heading') => { focus.current = target; setState(next) }

  useEffect(() => {
    const target = focus.current
    focus.current = 'none'
    if (target === 'heading') heading.current?.focus()
    else if (target === 'primary') primary.current?.focus()
    else if (target === 'email') emailInput.current?.focus()
    else if (target === 'password') { passwordInput.current?.focus(); passwordInput.current?.select() }
    else if (target === 'email-selected') { emailInput.current?.focus(); emailInput.current?.select() }
  }, [state])

  const signInOrAsk = async (address: string) => {
    if (!EMAIL.test(address)) return go({ step: 'form', error: 'email' }, 'email')
    if (!password) return go({ step: 'form', error: 'password' }, 'password')
    // Checking keeps the same form on screen (read-only), so focus stays where it was.
    go({ step: 'checking' }, 'none')
    try {
      await withIdentityMutation(async token => {
        const reply = await api.post<{ next?: string }>('/api/auth/continue', { email: address, password }, { identityToken: token })
        if (reply?.next === 'create') throw new NoJournal()
        return reply
      }, '/overview')
    } catch (error) {
      // The create step focuses Create account, the one documented exception to focusing the heading.
      if (error instanceof NoJournal) return go({ step: 'create', email: address }, 'primary')
      const code = codeOf(error)
      // The form's heading doesn't change on an error; the wrong-password board (1.4) has focus back in the password.
      if (code === 'INVALID_CREDENTIALS' || code === 'INVALID_EMAIL_OR_PASSWORD') return go({ step: 'form', error: 'invalid' }, 'password')
      if (code === 'INVALID_EMAIL' || code === 'MISSING_CREDENTIALS') return go({ step: 'form', error: 'email' }, 'email')
      if (code === 'MISSING_PASSWORD') return go({ step: 'form', error: 'password' }, 'password')
      go({ step: 'form', error: statusOf(error) === 429 ? 'rate' : 'network' }, 'none')
    }
  }

  const createJournal = async (address: string) => {
    if (password.length < 8) return go({ step: 'create', email: address, error: 'short' }, 'password')
    go({ step: 'creating', email: address }, 'none')
    try {
      await withIdentityMutation(token => api.post('/api/auth/signup', { email: address, password }, { identityToken: token }), '/onboarding')
    } catch (error) {
      const code = codeOf(error)
      if (code === 'WEAK_PASSWORD') return go({ step: 'create', email: address, error: 'short' }, 'password')
      if (code === 'EMAIL_TAKEN') return go({ step: 'form', error: 'taken' })
      if (code === 'SIGN_IN_REQUIRED') return go({ step: 'form', notice: 'created' })
      if (code === 'INVALID_EMAIL') return go({ step: 'form', error: 'email' }, 'email')
      go({ step: 'create', email: address, error: statusOf(error) === 429 ? 'rate' : 'network' }, 'none')
    }
  }

  const submit = () => {
    if (state.step === 'form') void signInOrAsk(email.trim())
    else if (state.step === 'create') void createJournal(state.email)
  }

  const changeEmail = (value: string) => {
    setEmail(value)
    // The create step is only valid for the email it was checked against; typing keeps focus in the field.
    if (state.step === 'create') go({ step: 'form' }, 'none')
    else if (state.step === 'form' && state.error === 'email') go({ step: 'form' }, 'none')
  }
  const changePassword = (value: string) => {
    setPassword(value)
    if (state.step === 'form' && state.error === 'password') go({ step: 'form' }, 'none')
    else if (state.step === 'create' && state.error === 'short') go({ step: 'create', email: state.email }, 'none')
  }

  const error = 'error' in state ? state.error : undefined
  const notice = state.step === 'form' ? state.notice : undefined
  return <AuthCardFrame locale={locale}>
    <div className="auth-step" data-step={state.step === 'create' || state.step === 'creating' ? 'create' : 'form'}>
      <FormStep locale={locale} step={state.step} email={email} password={password}
        error={error} notice={notice} headingRef={heading} emailRef={emailInput} passwordRef={passwordInput} primaryRef={primary}
        onEmailChange={changeEmail} onPasswordChange={changePassword} onSubmit={submit}
        onChangeEmail={() => go({ step: 'form' }, 'email-selected')}
        // Until the card has its own request state (ticket 08), the link to get back in opens the recovery page.
        onGetBackIn={() => router.push('/forgot-password')} />
      <Tagline locale={locale} index={tagline} />
    </div>
  </AuthCardFrame>
}
