import { Avatar, AvatarImage, AvatarFallback } from 'facehash'

interface UserAvatarProps {
  /** User ID used as seed for deterministic face generation */
  userId: string
  /** Custom avatar URL (uploaded photo) — shown when available */
  avatarUrl?: string | null
  /** Display name for alt text */
  name?: string
  /** Size in pixels */
  size?: number
  /** Additional CSS classes for the outer container */
  className?: string
}

/**
 * UserAvatar — Shows a user's custom photo or a deterministic Facehash face.
 *
 * Uses facehash's Avatar primitive: if avatar_url loads, it's shown;
 * otherwise falls back to a unique face generated from the user ID.
 */
export function UserAvatar({ userId, avatarUrl, name, size = 40, className }: UserAvatarProps) {
  return (
    <Avatar
      className={className}
      style={{ width: size, height: size, borderRadius: 'inherit', display: 'block' }}
    >
      <AvatarImage
        src={avatarUrl}
        alt={name ?? 'Avatar'}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <AvatarFallback
        name={userId}
        facehashProps={{
          size,
          variant: 'gradient',
          intensity3d: 'subtle',
          showInitial: false,
          interactive: false,
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </Avatar>
  )
}
