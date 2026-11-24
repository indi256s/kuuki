'use client'
import type { CSSProperties } from 'react'
import { Avatar, AvatarImage, AvatarFallback, FACES, stringHash } from 'facehash'
import { AVATAR_FACES, isAvatarFace, type AvatarFace } from '@kuuki/shared/avatar'
import './profile.css'

const INKS = ['indigo', 'oxblood', 'slate', 'moss', 'plum', 'teal', 'umber', 'ochre-dark'] as const

export function avatarFace(id: string, face?: string | null): AvatarFace {
  return isAvatarFace(face) ? face : AVATAR_FACES[stringHash(id) % AVATAR_FACES.length]!
}

export const avatarInk = (id: string) =>
  `var(--stamp-ink-${INKS[Math.floor(stringHash(id) / AVATAR_FACES.length) % INKS.length]})`

export function AvatarFaceMark({ id, face }: { id: string; face?: string | null }) {
  const character = avatarFace(id, face)
  const Eyes = FACES[AVATAR_FACES.indexOf(character)]!
  const hash = stringHash(id)
  return (
    <span
      className="avatar-face"
      data-face={character}
      style={
        {
          '--avatar-ink': avatarInk(id),
          '--avatar-blink-delay': `-${hash % 9}s`,
        } as CSSProperties
      }
    >
      <Eyes />
    </span>
  )
}

export function ProfileAvatar({
  id,
  url,
  name,
  face,
  size = 72,
}: {
  id: string
  url?: string | null
  name: string
  face?: string | null
  size?: number
}) {
  return (
    <Avatar className="profile-avatar" style={{ width: size, height: size }}>
      <AvatarImage
        src={url}
        alt={name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <AvatarFallback>
        <AvatarFaceMark id={id} face={face} />
      </AvatarFallback>
    </Avatar>
  )
}
