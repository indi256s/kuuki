'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { api, ApiError } from '@kuuki/client/apiClient'
import { withIdentityMutation } from '../activity'
import { markOnboarded } from '../welcome/api'
import { dissolve } from '../welcome/dissolve'
import { morph } from '../welcome/morph'
import { PassportPreview } from '../welcome/passport/passport-preview'
import type { PassportPreview as Preview, WelcomeInit } from '../welcome/types'
import { WelcomeFlow } from '../welcome/welcome-flow'
import '../welcome/welcome.css'
import type { Locale } from '../../lib/format'
import { BrandPanel } from './brand-panel'
import { CornerControls } from './corner-controls'
import { FormStep } from './form-step'
import { GetBackInStep, type RequestState } from './get-back-in-step'
import { PlaneField } from './plane-field'
import { Tagline } from './taglines'
import './auth-card.css'

/**
 * The card's static frame: brand panel (left on desktop, the band above the sheet on mobile), corner controls, and the
 * form panel holding `children`. Shared by every auth surface so the top stays put while the content changes.
 */
export function AuthCardFrame({
  locale,
  brandField,
  theme,
  onLocaleChange,
  cardRef,
  welcomeStep,
  children,
}: {
  locale: Locale
  brandField?: ReactNode
  theme?: ReactNode
  onLocaleChange?: (locale: Locale) => void
  cardRef?: Ref<HTMLDivElement>
  /** Onboarding inside the card: the step drives the card height and the mobile sheet. */
  welcomeStep?: string
  children: ReactNode
}) {
  return (
    <div className="auth-card" ref={cardRef} data-welcome={welcomeStep}>
      <BrandPanel field={brandField ?? <PlaneField />} />
      <CornerControls locale={locale} theme={theme} onLocaleChange={onLocaleChange} />
      <section className="auth-form-panel">
        <div className="auth-column">{children}</div>
      </section>
    </div>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The card's states (spec "Client state machine").
 * `form` also carries `taken` (409 from Create account) and the `created` notice (account made, session not issued),
 * and client-side `email` / `password` validation, which the spec's shorter list leaves implicit.
 */
export type CardState =
  | {
      step: 'form'
      error?: 'email' | 'password' | 'invalid' | 'rate' | 'network' | 'taken'
      notice?: 'created' | 'password-saved'
    }
  | { step: 'checking' }
  | { step: 'create'; email: string; error?: 'short' | 'rate' | 'network' }
  | { step: 'creating'; email: string }
  | { step: 'welcome'; init: WelcomeInit }
  | RequestState

/** Where focus goes after a state change. The heading is the default; the create step and Change are the exceptions. */
type FocusTarget = 'heading' | 'primary' | 'email-selected' | 'email' | 'password' | 'none'

/** Continue answered `{ next: 'create' }`: no session was issued, so the identity mutation must not navigate. */
class NoJournal extends Error {}

/** A new account starts onboarding with nothing saved. */
const freshWelcome = (ownerId: string): WelcomeInit => ({
  ownerId,
  step: 'name',
  displayName: '',
  username: null,
  batch: null,
  manual: false,
  saved: null,
  // Unknown until the first submission answers 202; a fresh account has no batch to resume.
  jobs: false,
})

/** The signed-in member's own profile, read under the identity lock: finished onboarding or not. */
async function onboardedAfterSignIn(token: symbol) {
  try {
    const me = await api.get<{ profile?: { onboarded_at?: string | null } | null }>(
      '/api/auth/me',
      undefined,
      { identityToken: token },
    )
    return !!me?.profile?.onboarded_at
  } catch {
    // Unknown: land on the Overview; its gate sends an unfinished member to the card.
    return true
  }
}

/** Sign-in and signup return a user ID; a 2xx response alone does not establish a session. */
function sessionReply(reply: unknown) {
  const data = reply as { next?: unknown; user?: { id?: unknown } } | null | undefined
  if (
    !data ||
    typeof data !== 'object' ||
    'next' in data ||
    typeof data.user?.id !== 'string' ||
    !data.user.id.trim()
  ) {
    throw new Error('Invalid auth response')
  }
  return reply
}

const codeOf = (error: unknown) => (error instanceof ApiError ? error.code : undefined)
const statusOf = (error: unknown) => (error instanceof ApiError ? error.status : undefined)

/**
 * The one-form auth card. Continue posts to `/api/auth/continue`: a session lands in the journal, a wrong password
 * stays on the form with an error, and an unknown email turns the card into the create step in place.
 */
export function AuthCard({
  locale,
  initialEmail = '',
  initialStep = 'form',
  initialNotice,
  tagline,
  welcome,
}: {
  locale: Locale
  initialEmail?: string
  initialStep?: 'form' | 'request'
  initialNotice?: 'password-saved'
  tagline: number
  /** Set on `/welcome/*`: the card opens at this onboarding step. */
  welcome?: WelcomeInit
}) {
  const [state, setState] = useState<CardState>(
    welcome
      ? { step: 'welcome', init: welcome }
      : initialStep === 'request'
        ? { step: 'request', email: initialEmail }
        : { step: 'form', notice: initialNotice },
  )
  const card = useRef<HTMLDivElement>(null)
  const [passport, setPassport] = useState<Preview | null>(null)
  const onPassport = useCallback((preview: Preview) => setPassport(preview), [])
  // "I'll do this later", "Start empty" and "Open my journal": record it first, then dissolve into the Overview.
  const finish = useCallback(async () => {
    await markOnboarded()
    await dissolve(card.current)
    // oxlint-disable-next-line next-compat/no-location-assign-relative-destination -- a document navigation drops the guest-era router cache (spec "Dissolve")
    window.location.assign('/overview')
  }, [])
  const [email, setEmail] = useState(() => {
    if (initialEmail || !initialNotice || typeof window === 'undefined') return initialEmail
    try {
      return sessionStorage.getItem('kuuki_auth_email') ?? ''
    } catch {
      return ''
    }
  })
  const [password, setPassword] = useState('')
  const focus = useRef<FocusTarget>(initialStep === 'request' ? 'heading' : 'none')
  const heading = useRef<HTMLHeadingElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const primary = useRef<HTMLButtonElement>(null)

  const go = (next: CardState, target: FocusTarget = 'heading') => {
    focus.current = target
    setState(next)
  }

  useEffect(() => {
    const target = focus.current
    focus.current = 'none'
    if (target === 'heading') heading.current?.focus()
    else if (target === 'primary') primary.current?.focus()
    else if (target === 'email') emailInput.current?.focus()
    else if (target === 'password') {
      passwordInput.current?.focus()
      passwordInput.current?.select()
    } else if (target === 'email-selected') {
      emailInput.current?.focus()
      emailInput.current?.select()
    }
  }, [state])

  const signInOrAsk = async (address: string) => {
    if (!EMAIL.test(address)) return go({ step: 'form', error: 'email' }, 'email')
    if (!password) return go({ step: 'form', error: 'password' }, 'password')
    go({ step: 'checking' })
    try {
      await withIdentityMutation(
        async (token) => {
          const reply = await api.post<unknown>(
            '/api/auth/continue',
            { email: address, password },
            { identityToken: token },
          )
          if (reply && typeof reply === 'object' && 'next' in reply && reply.next === 'create')
            throw new NoJournal()
          sessionReply(reply)
          return { onboarded: await onboardedAfterSignIn(token) }
        },
        '/overview',
        {
          // An unfinished member resumes the card at their step (the server picks it); everyone else dissolves.
          target: ({ onboarded }) => (onboarded ? '/overview' : '/welcome/name'),
          beforeNavigate: ({ onboarded }) => (onboarded ? dissolve(card.current) : undefined),
        },
      )
    } catch (error) {
      // The create step focuses Create account, the one documented exception to focusing the heading.
      if (error instanceof NoJournal) return go({ step: 'create', email: address }, 'primary')
      const code = codeOf(error)
      if (code === 'INVALID_CREDENTIALS' || code === 'INVALID_EMAIL_OR_PASSWORD')
        return go({ step: 'form', error: 'invalid' })
      if (code === 'INVALID_EMAIL' || code === 'MISSING_CREDENTIALS')
        return go({ step: 'form', error: 'email' })
      if (code === 'MISSING_PASSWORD') return go({ step: 'form', error: 'password' })
      go({ step: 'form', error: statusOf(error) === 429 ? 'rate' : 'network' })
    }
  }

  const createJournal = async (address: string) => {
    if (password.length < 8)
      return go({ step: 'create', email: address, error: 'short' }, 'password')
    go({ step: 'creating', email: address })
    try {
      const reply = (await withIdentityMutation(
        async (token) =>
          sessionReply(
            await api.post(
              '/api/auth/signup',
              { email: address, password },
              { identityToken: token },
            ),
          ),
        '/welcome/name',
        { inPlaceOwner: (result) => (result as { user: { id: string } }).user.id },
      )) as { user: { id: string } }
      // In place, the URL is already `/welcome/name` and the card morphs; otherwise the page is navigating away.
      if (window.location.pathname === '/welcome/name')
        morph('forward', () => go({ step: 'welcome', init: freshWelcome(reply.user.id) }))
    } catch (error) {
      const code = codeOf(error)
      if (code === 'WEAK_PASSWORD') return go({ step: 'create', email: address, error: 'short' })
      if (code === 'EMAIL_TAKEN') return go({ step: 'form', error: 'taken' })
      if (code === 'SIGN_IN_REQUIRED') return go({ step: 'form', notice: 'created' })
      if (code === 'INVALID_EMAIL') return go({ step: 'form', error: 'email' })
      go({ step: 'create', email: address, error: statusOf(error) === 429 ? 'rate' : 'network' })
    }
  }

  const sendLink = async (address: string) => {
    if (address.length > 320 || !EMAIL.test(address))
      return go({ step: 'request', email: address, error: 'invalid' })
    setEmail(address)
    go({ step: 'sending', email: address })
    try {
      const reply = await api.post<unknown>('/api/auth/link/request', { email: address })
      if (!reply || typeof reply !== 'object' || !('ok' in reply) || reply.ok !== true)
        throw new Error('Invalid link response')
      // A user-typed hint for password managers after reset, never a claim that this account exists.
      try {
        sessionStorage.setItem('kuuki_auth_email', address)
      } catch {
        /* The request still succeeds when storage is blocked. */
      }
      go({ step: 'sent', email: address, resendAt: Date.now() + 60_000 })
    } catch (error) {
      const status = statusOf(error)
      go({
        step: 'request',
        email: address,
        error:
          status === 400
            ? 'invalid'
            : status === 429
              ? 'rate'
              : status === 503
                ? 'paused'
                : 'network',
      })
    }
  }

  const requestLink = () => {
    if (state.step === 'request' || (state.step === 'sent' && Date.now() >= state.resendAt))
      void sendLink(state.email.trim())
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
    else if (state.step === 'request') go({ step: 'request', email: value }, 'none')
  }
  const changePassword = (value: string) => {
    setPassword(value)
    if (state.step === 'form' && state.error === 'password') go({ step: 'form' }, 'none')
    else if (state.step === 'create' && state.error === 'short')
      go({ step: 'create', email: state.email }, 'none')
  }

  const notice = state.step === 'form' ? state.notice : undefined
  if (state.step === 'welcome')
    return (
      <AuthCardFrame
        locale={locale}
        cardRef={card}
        welcomeStep={passport?.step ?? state.init.step}
        brandField={passport ? <PassportPreview preview={passport} locale={locale} /> : undefined}
      >
        <WelcomeFlow init={state.init} locale={locale} onPassport={onPassport} onFinish={finish} />
      </AuthCardFrame>
    )
  return (
    <AuthCardFrame locale={locale} cardRef={card}>
      <div
        className="auth-step"
        data-step={state.step === 'create' || state.step === 'creating' ? 'create' : 'form'}
      >
        {state.step === 'request' || state.step === 'sending' || state.step === 'sent' ? (
          <GetBackInStep
            locale={locale}
            state={state}
            headingRef={heading}
            emailRef={emailInput}
            onEmailChange={changeEmail}
            onSend={requestLink}
            onBack={() => go({ step: 'form' })}
            onDifferentEmail={() => go({ step: 'request', email: state.email })}
          />
        ) : (
          <FormStep
            locale={locale}
            step={state.step}
            email={email}
            password={password}
            error={'error' in state ? state.error : undefined}
            notice={notice}
            headingRef={heading}
            emailRef={emailInput}
            passwordRef={passwordInput}
            primaryRef={primary}
            onEmailChange={changeEmail}
            onPasswordChange={changePassword}
            onSubmit={submit}
            onChangeEmail={() => go({ step: 'form' }, 'email-selected')}
            onGetBackIn={() => {
              if (state.step !== 'checking' && state.step !== 'creating')
                go({ step: 'request', email })
            }}
          />
        )}
        {state.step === 'form' ||
        state.step === 'checking' ||
        state.step === 'create' ||
        state.step === 'creating' ? (
          <Tagline locale={locale} index={tagline} />
        ) : null}
      </div>
    </AuthCardFrame>
  )
}
