'use client'

import { Globe, Lock } from '@keyline-icons/react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ProfileAvatar } from '../profile/avatar'
import { FoundingCrew } from '../profile/founding-crew'
import { ShareProfile } from '../profile/profile'
import type { Locale } from '../../lib/format'
import './passport.css'

export type IdentityProfile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  avatar_face?: string | null
}

/** The owner-only part of the identity row: visibility, Share, the narrator line and the menu. */
export type IdentityOwner = {
  visibility: 'public' | 'private'
  shareUrl: string | null
  remarks: string | null
  menu: ReactNode
}

/** Compact identity: avatar, name (the page's H1), handle and the Founding crew stub when earned. */
export function PassportIdentity({
  locale,
  profile,
  bio,
  fallbackHandle,
  founding,
  owner,
}: {
  locale: Locale
  profile: IdentityProfile
  bio: string | null
  /** The handle from the route when the read carries none. */
  fallbackHandle: string | null
  founding: boolean
  owner: IdentityOwner | null
}) {
  const ru = locale === 'ru'
  const handle = profile.username ?? fallbackHandle
  const name = profile.display_name || handle || (ru ? 'Участник Kuuki' : 'Kuuki member')
  const privateOwner = owner?.visibility === 'private'
  return (
    <header className="passport-identity">
      <div className="passport-identity-row">
        <ProfileAvatar
          id={profile.id}
          url={profile.avatar_url}
          face={profile.avatar_face}
          name={name}
          size={64}
        />
        <div className="passport-identity-text">
          <h1>{name}</h1>
          {handle || founding ? (
            <p className="passport-handle">
              {handle ? <span>@{handle}</span> : null}
              {founding ? <FoundingCrew locale={locale} /> : null}
            </p>
          ) : null}
        </div>
        {owner ? (
          <div className="passport-identity-actions">
            <Link
              href="/settings"
              className="profile-visibility"
              data-private={privateOwner || undefined}
              aria-label={
                privateOwner
                  ? ru
                    ? 'Скрытый профиль, изменить в настройках'
                    : 'Private profile, change in Settings'
                  : ru
                    ? 'Открытый профиль, изменить в настройках'
                    : 'Public profile, change in Settings'
              }
            >
              {privateOwner ? (
                <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Globe size={16} strokeWidth={1.75} aria-hidden="true" />
              )}
              {privateOwner ? (ru ? 'Скрыт' : 'Private') : ru ? 'Открыт' : 'Public'}
            </Link>
            {!privateOwner && owner.shareUrl ? (
              <ShareProfile url={owner.shareUrl} title={name} locale={locale} />
            ) : null}
            {owner.menu}
          </div>
        ) : null}
      </div>
      {bio ? <p className="passport-bio">{bio}</p> : null}
      {privateOwner ? (
        <p className="passport-note">
          {ru
            ? 'Ваш профиль скрыт. Другие видят закрытый паспорт.'
            : 'Your profile is private. Others see a closed passport.'}{' '}
          <Link href="/settings" className="profile-inline-link">
            {ru ? 'Изменить в настройках' : 'Change in Settings'}
          </Link>
        </p>
      ) : null}
      {owner?.remarks ? (
        <div className="passport-remarks">
          <p className="passport-remarks-line">{owner.remarks}</p>
          <p className="passport-note">{ru ? 'Видите только вы' : 'Only you see this'}</p>
        </div>
      ) : null}
    </header>
  )
}
