import 'server-only'
import { getRequestEnv, getRequestIdentity } from './identity'
import { getProfileRow, toOwnProfile } from '../../../../functions/api/_lib/profiles'
import { toUserStats, type UserStatsRow } from '../../../../functions/api/_lib/stats'
import { readOwnBadges } from '../../../../functions/api/_services/ownBadges'
import {
  readPublicProfilePreview,
  type PassportPublication,
} from '../../../../functions/api/_services/publicProfiles'
import { readOwnRankings } from './profile'
import { getPublicProfile } from './public'
import {
  readPassport,
  type PassportData,
  type readCountryDetail,
} from '../../../../functions/api/_services/passport'

export type {
  Visit,
  Claim,
  GroundVisit,
  PassportData,
} from '../../../../functions/api/_services/passport'
/** Published country evidence: `status` is `pressed` or `pending` (awaiting-only, never a stamp). */
export type PassportCountry = PassportData['countries'][number]
/** GET /api/passport/countries/:cc/stats: published status plus every contributing entry (ADR 0001 §4). */
export type CountryDetail = Awaited<ReturnType<typeof readCountryDetail>>

/** Owner page data in one call: the passport, identity, stats, badges and rankings the shared Passport page shows. */
export async function getOwnPassport() {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const { DB } = await getRequestEnv()
  const [data, profileRow, statsRow, badges, rankings] = await Promise.all([
    readPassport(DB, identity.id),
    getProfileRow(DB, identity.id),
    DB.prepare('SELECT * FROM user_stats WHERE user_id = ?')
      .bind(identity.id)
      .first<UserStatsRow>(),
    readOwnBadges(DB, identity.id),
    readOwnRankings(DB, identity.id),
  ])
  if (!profileRow) return null
  const own = toOwnProfile(profileRow)
  return {
    ownerId: identity.id,
    data,
    profile: {
      id: own.id,
      username: own.username,
      display_name: own.display_name,
      avatar_url: own.avatar_url,
      avatar_face: own.avatar_face,
      bio: own.bio,
      created_at: own.created_at,
      is_public: own.is_public,
      theme_color: own.theme_color,
      passport_publication: own.passport_publication,
      show_on_leaderboards: own.show_on_leaderboards,
    },
    stats: statsRow ? toUserStats(statsRow) : null,
    badges,
    rankings,
  }
}

/** What the owner page renders. */
export type OwnPassport = NonNullable<Awaited<ReturnType<typeof getOwnPassport>>>

/** The visitor view of a public passport (null when the username is unknown). */
export function getPublicPassport(username: string) {
  return getPublicProfile(username)
}

/** The owner's public profile as it would read under `scope` (default: the stored publication). */
export async function getOwnPublicPreview(scope?: PassportPublication) {
  const identity = await getRequestIdentity()
  if (!identity) return null
  const { DB } = await getRequestEnv()
  const effective =
    scope ?? (await getProfileRow(DB, identity.id))?.passport_publication ?? 'flights'
  return readPublicProfilePreview(DB, identity.id, effective)
}
