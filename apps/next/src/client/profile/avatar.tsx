'use client'
import type { CSSProperties } from 'react'
import { Avatar, AvatarImage, AvatarFallback, FACES, stringHash } from 'facehash'
import { AVATAR_FACES, isAvatarFace, type AvatarFace } from '@kuuki/shared/avatar'
import './profile.css'

/** Passport stamp inks: theme-aware, 4.5:1 on --surface, independent of the accent. */
const INKS = ['indigo', 'oxblood', 'slate', 'moss', 'plum', 'teal', 'umber', 'ochre-dark'] as const

/** The member's character: their pick, else one derived from the id so a rename never changes it. */
export function avatarFace(id: string, face?: string | null): AvatarFace {
  return isAvatarFace(face) ? face : AVATAR_FACES[stringHash(id) % AVATAR_FACES.length]!
}

/** The generated face alone: ink eyes on a tint of the same ink. Color always follows the id. */
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
          '--avatar-ink': `var(--stamp-ink-${INKS[Math.floor(hash / AVATAR_FACES.length) % INKS.length]})`,
          // A negative delay spreads the blinks so a list of faces never blinks in unison.
          '--avatar-blink-delay': `-${hash % 9}s`,
        } as CSSProperties
      }
    >
      <Eyes />
    </span>
  )
}

/** Same photo/fallback contract as UserAvatar, using the Next semantic palette. */
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
