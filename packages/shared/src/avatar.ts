export const AVATAR_FACES = ['curious', 'jetlag', 'sleepy', 'content'] as const
export type AvatarFace = (typeof AVATAR_FACES)[number]

export const isAvatarFace = (value: unknown): value is AvatarFace =>
  (AVATAR_FACES as readonly unknown[]).includes(value)
