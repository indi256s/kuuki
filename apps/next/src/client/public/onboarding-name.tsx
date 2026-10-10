'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation } from '../activity'
import { ProfileAvatar } from '../profile/avatar'
import { Button } from '../ui/button'
import { Field } from '../ui/field'

export function OnboardingName({
  ownerId,
  username: initialUsername,
  displayName: initialName,
  profileUrl,
  locale,
}: {
  ownerId: string
  username: string
  displayName: string
  profileUrl: string
  locale: 'en' | 'ru'
}) {
  const router = useRouter()
  const saveController = useRef<AbortController | null>(null)
  useEffect(() => () => saveController.current?.abort(), [])
  const ru = locale === 'ru'
  const [username, setUsername] = useState(initialUsername)
  const [name, setName] = useState(initialName)
  const [check, setCheck] = useState<{
    value: string
    status: 'available' | 'taken' | 'checking' | 'failed'
  } | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  const normalized = username.trim().toLowerCase()
  const valid = /^[a-z0-9_]{3,30}$/.test(normalized)
  const available =
    normalized === initialUsername || (check?.value === normalized && check.status === 'available')
  const preview = new URL(profileUrl)
  preview.pathname = `/fly/${normalized || 'your-name'}`
  useEffect(() => {
    if (!valid || normalized === initialUsername) return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    const timer = setTimeout(() => {
      setCheck({ value: normalized, status: 'checking' })
      void api
        .get<{ available: boolean }>(
          '/api/profiles/check-username',
          { username: normalized },
          { signal: controller.signal },
        )
        .then((result) => {
          if (current())
            setCheck({ value: normalized, status: result.available ? 'available' : 'taken' })
        })
        .catch(() => {
          if (current()) setCheck({ value: normalized, status: 'failed' })
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
      release()
    }
  }, [normalized, valid, initialUsername, retry])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving || !valid || !available) return
    setMessage('')
    setSaving(true)
    const controller = new AbortController()
    saveController.current = controller
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    const current = () => !controller.signal.aborted && generation === getAuthGeneration()
    try {
      await api.patch(
        '/api/profiles/me',
        { username: normalized, display_name: name.trim() || null },
        { signal: controller.signal },
      )
      if (current()) {
        router.push('/onboarding?step=capture')
        router.refresh()
      }
    } catch (error) {
      if (current())
        setMessage(
          error instanceof ApiError && error.status === 409
            ? ru
              ? 'Это имя уже занято.'
              : 'That username is already taken.'
            : ru
              ? 'Не удалось сохранить профиль. Повторите попытку.'
              : 'Could not save your profile. Please try again.',
        )
    } finally {
      release()
      if (current()) setSaving(false)
    }
  }
  const availability = !valid
    ? ru
      ? 'Используйте от 3 до 30 латинских букв, цифр или подчёркиваний.'
      : 'Use 3–30 Latin letters, numbers, or underscores.'
    : available
      ? ru
        ? 'Имя доступно.'
        : 'Username available.'
      : check?.value !== normalized || check.status === 'checking'
        ? ru
          ? 'Проверяем имя…'
          : 'Checking username…'
        : check.status === 'taken'
          ? ru
            ? 'Это имя уже занято.'
            : 'That username is already taken.'
          : ru
            ? 'Не удалось проверить имя. Измените имя или повторите проверку.'
            : 'Could not check username. Edit it or retry the check.'
  const taken = valid && !available && check?.value === normalized && check.status === 'taken'
  return (
    <form className="onboarding-form" onSubmit={save}>
      <ProfileAvatar
        id={ownerId}
        url={null}
        name={name.trim() || normalized || (ru ? 'Ваш профиль' : 'Your profile')}
      />
      <Field
        label={ru ? 'Отображаемое имя' : 'Display name'}
        value={name}
        maxLength={80}
        disabled={saving}
        onChange={(event) => setName(event.target.value)}
      />
      <Field
        label={ru ? 'Имя пользователя' : 'Username'}
        hint={
          ru
            ? 'Мы сохраняем имя пользователя строчными латинскими буквами.'
            : 'We save your username in lowercase Latin letters.'
        }
        value={username}
        disabled={saving}
        onChange={(event) => {
          setUsername(event.target.value)
          setMessage('')
        }}
        autoComplete="username"
        maxLength={30}
        aria-describedby="onboarding-availability"
        error={taken ? availability : undefined}
      />
      <p className="onboarding-url">{preview.href}</p>
      <p id="onboarding-availability" role="status">
        {taken ? null : availability}
      </p>
      {check?.value === normalized && check.status === 'failed' && (
        <Button variant="secondary" type="button" onClick={() => setRetry((value) => value + 1)}>
          {ru ? 'Повторить проверку' : 'Retry check'}
        </Button>
      )}
      {message && <p role="alert">{message}</p>}
      <Button
        type="submit"
        variant="primary"
        loading={saving}
        loadingLabel={ru ? 'Сохраняем…' : 'Saving…'}
        disabled={!valid || !available}
      >
        {ru ? 'Продолжить' : 'Continue'}
      </Button>
    </form>
  )
}
