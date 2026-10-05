'use client'
import { Avatar, AvatarImage, AvatarFallback } from 'facehash'
import './profile.css'

/** Same photo/fallback contract as UserAvatar, using the Next semantic palette. */
export function ProfileAvatar({ id, url, name, size = 72 }: { id: string; url?: string | null; name: string; size?: number }) {
  return <Avatar className="profile-avatar" style={{ width: size, height: size }}>
    <AvatarImage src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    <AvatarFallback name={id} facehashProps={{ size, colors: ['var(--surface-inset)', 'var(--surface)'], variant: 'solid', interactive: true, showInitial: false, intensity3d: 'subtle' }} />
  </Avatar>
}
