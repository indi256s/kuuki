import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnPassport, getOwnPublicPreview, type OwnPassport } from '../../../server/passport'
import { getProfileShareUrl } from '../../../server/profile'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { normalizePassportQuery, withQuery } from '../../../lib/url-state'
import { isCatalogCountry } from '../../../client/passport/model'
import { IdentitySnapshot } from '../../../client/activity'
import { ReadFreshness } from '../../../client/freshness'
import { LocaleText } from '../../../client/locale-text'
import { PassportPage } from '../../../client/passport/passport-page'
import '../../reads.css'

async function OwnerPassport({ owned }: { owned: OwnPassport }) {
  const locale = await getRequestLocale()
  const { profile } = owned
  const shareUrl =
    profile.is_public && profile.username ? await getProfileShareUrl(profile.username) : null
  return (
    <IdentitySnapshot ownerId={owned.ownerId}>
      <ReadFreshness
        ownerId={owned.ownerId}
        revision={owned.data.revision}
        publishedRevision={owned.data.publishedRevision}
        derivedState={owned.data.derivedState}
        locale={locale}
      />
      <PassportPage
        mode="owner"
        locale={locale}
        ownerId={owned.ownerId}
        data={owned.data}
        // Only the allowlisted identity fields enter the client island.
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
        routeHandle={profile.username ?? ''}
        visibility={profile.is_public ? 'public' : 'private'}
        shareUrl={shareUrl}
        stats={owned.stats}
        badges={owned.badges}
        rankings={owned.rankings}
        derivedState={owned.data.derivedState}
      />
    </IdentitySnapshot>
  )
}

/** The owner's public projection as a visitor would read it; no owner passport data is fetched or passed. */
async function VisitorPreview() {
  const [preview, locale] = await Promise.all([getOwnPublicPreview(), getRequestLocale()])
  if (!preview) redirect('/signin')
  const { profile } = preview
  return (
    <IdentitySnapshot ownerId={profile.id}>
      <PassportPage
        mode="preview"
        locale={locale}
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
        routeHandle={profile.username ?? ''}
        countries={preview.countries}
        stats={preview.stats}
        badges={preview.badges}
        rankings={preview.rankings}
        derivedState={preview.derivedState}
      />
    </IdentitySnapshot>
  )
}

async function PassportData({ preview }: { preview: boolean }) {
  if (preview) return <VisitorPreview />
  const owned = await getOwnPassport()
  if (!owned) redirect('/signin')
  return <OwnerPassport owned={owned} />
}
export const generateMetadata = () => pageMetadata('Passport', 'Паспорт')
export default async function Passport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireOnboardedMember()
  const locale = await getRequestLocale()
  const normalized = normalizePassportQuery(await searchParams, isCatalogCountry)
  if (!normalized.canonical) redirect(withQuery('/passport', normalized.query))
  return (
    <Suspense
      fallback={
        <p className="loading" role="status">
          <LocaleText locale={locale} en="Loading passport…" ru="Загружаем паспорт…" />
        </p>
      }
    >
      <PassportData preview={normalized.state.as === 'visitor'} />
    </Suspense>
  )
}
