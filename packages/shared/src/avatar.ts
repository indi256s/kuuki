/**
 * Characters a member can pick for the generated avatar, in Facehash's FACES order (round, cross, line, curved).
 * A null choice derives one from the member id, so a rename never changes the face.
 */
export const AVATAR_FACES = ['curious', 'jetlag', 'sleepy', 'content'] as const
export type AvatarFace = (typeof AVATAR_FACES)[number]

export const isAvatarFace = (value: unknown): value is AvatarFace =>
  (AVATAR_FACES as readonly unknown[]).includes(value)
