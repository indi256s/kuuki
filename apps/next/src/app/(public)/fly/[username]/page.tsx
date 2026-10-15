import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getPublicPassport } from '../../../../server/passport'
import { getOptionalPublicViewer } from '../../../../server/identity'
import { getRequestLocale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'
import { IdentitySnapshot } from '../../../../client/activity'
import { isCatalogCountry } from '../../../../client/passport/model'
import { PassportPage } from '../../../../client/passport/passport-page'
import { ProfileClosed, ProfileLoading } from '../../../../client/profile/profile-states'
import { profileViewState } from '../../../../client/profile/view'
import { normalizePassportQuery, withQuery } from '../../../../lib/url-state'

export const generateMetadata = () => pageMetadata('Profile', 'Профиль')
export async function ProfileData({ username }: { username: string }) {
  const [data, viewer, locale] = await Promise.all([
    getPublicPassport(username),
    getOptionalPublicViewer(),
    getRequestLocale(),
  ])
  const state = profileViewState(data?.profile, viewer?.id)
  // A private owner has no public page to read: show what a visitor would see if it were published.
  if (state.kind === 'owner' && state.visibility === 'private') redirect('/passport?as=visitor')
  if (!data || state.kind === 'not-found' || state.kind === 'closed')
    return (
      <ProfileClosed
        kind={state.kind === 'closed' ? 'private' : 'missing'}
        viewer={viewer ? 'member' : 'guest'}
        locale={locale}
      />
    )
  const { profile } = data
  const page = (
    <PassportPage
      mode="visitor"
      locale={locale}
      // Only allowlisted identity fields enter the client island.
      profile={{
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        avatar_face: profile.avatar_face,
        bio: profile.bio,
        is_public: profile.is_public,
        theme_color: profile.theme_color,
      }}
      routeHandle={username}
      countries={data.countries}
      stats={data.stats}
      badges={data.badges}
      rankings={data.rankings}
      derivedState={data.derivedState}
      memberViewer={Boolean(viewer)}
      viewerIsOwner={state.kind === 'owner'}
    />
  )
  return state.kind === 'owner' ? (
    <IdentitySnapshot ownerId={profile.id}>{page}</IdentitySnapshot>
  ) : (
    page
  )
}
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ username }, locale] = await Promise.all([params, getRequestLocale()])
  const normalized = normalizePassportQuery(await searchParams, isCatalogCountry)
  if (!normalized.canonical)
    redirect(withQuery(`/fly/${encodeURIComponent(username)}`, normalized.query))
  return (
    <Suspense fallback={<ProfileLoading locale={locale} />}>
      <ProfileData username={username} />
    </Suspense>
  )
}
