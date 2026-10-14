import { Suspense } from 'react'
import { getPublicProfile } from '../../../../server/public'
import { getOptionalPublicViewer } from '../../../../server/identity'
import {
  getOwnProfile,
  getOwnProfileStats,
  getOwnBadges,
  getOwnStamps,
  getProfileShareUrl,
} from '../../../../server/profile'
import { getRequestLocale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'
import {
  ProfileContent,
  ProfileClosed,
  ProfileLoading,
} from '../../../../client/profile/profile-content'
import { profileViewState } from '../../../../client/profile/view'

export const generateMetadata = () => pageMetadata('Profile', 'Профиль')
export async function ProfileData({ username }: { username: string }) {
  const [data, viewer, locale] = await Promise.all([
    getPublicProfile(username),
    getOptionalPublicViewer(),
    getRequestLocale(),
  ])
  const state = profileViewState(data?.profile, viewer?.id)
  if (!data || state.kind === 'not-found' || state.kind === 'closed')
    return (
      <ProfileClosed
        kind={state.kind === 'closed' ? 'private' : 'missing'}
        viewer={viewer ? 'member' : 'guest'}
        locale={locale}
      />
    )
  const owner = state.kind === 'owner'
  const privateOwner = owner && state.visibility === 'private'
  const [own, privateStats, privateBadges, shareUrl, ownStamps] = await Promise.all([
    privateOwner ? getOwnProfile() : null,
    privateOwner ? getOwnProfileStats(data.profile.id) : null,
    privateOwner ? getOwnBadges(data.profile.id) : [],
    owner ? getProfileShareUrl(data.profile.username ?? username) : null,
    owner ? getOwnStamps(data.profile.id) : [],
  ])
  // Only allowlisted identity fields enter the client islands; own-profile includes private credentials.
  const profile = privateOwner && own ? own.profile : data.profile
  const stats = privateOwner ? privateStats : data.stats
  const badges = privateOwner ? privateBadges : data.badges
  return (
    <ProfileContent
      locale={locale}
      profile={{
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        bio: profile.bio,
        is_public: profile.is_public,
        theme_color: profile.theme_color,
      }}
      username={username}
      stats={stats}
      badges={badges}
      rankings={data.rankings}
      countries={data.countries}
      ownStamps={ownStamps}
      owner={owner}
      visibility={state.kind === 'owner' ? state.visibility : 'public'}
      memberViewer={Boolean(viewer)}
      shareUrl={shareUrl}
      derivedState={data.derivedState}
    />
  )
}
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, locale] = await Promise.all([params, getRequestLocale()])
  return (
    <Suspense fallback={<ProfileLoading locale={locale} />}>
      <ProfileData username={username} />
    </Suspense>
  )
}
