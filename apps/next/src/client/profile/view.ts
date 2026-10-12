// Which of the five profile pages a request gets (spec "States"). Visibility is decided by the public read; the
// viewer only decides whether a private profile is its owner's page or a closed cover.
export type ProfileViewState =
  | { kind: 'not-found' }
  | { kind: 'closed'; viewer: 'guest' | 'member' }
  | { kind: 'owner'; visibility: 'public' | 'private' }
  | { kind: 'public' }

export function profileViewState(
  profile: { id: string; is_public: boolean } | null | undefined,
  viewerId: string | null | undefined,
): ProfileViewState {
  if (!profile) return { kind: 'not-found' }
  if (viewerId && viewerId === profile.id)
    return { kind: 'owner', visibility: profile.is_public ? 'public' : 'private' }
  if (!profile.is_public) return { kind: 'closed', viewer: viewerId ? 'member' : 'guest' }
  return { kind: 'public' }
}
