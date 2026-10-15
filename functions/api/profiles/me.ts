// PATCH /api/profiles/me — update the authenticated user's profile. Only provided fields are
// written. Username uniqueness is enforced case-insensitively. (GET own profile lives at
// /api/auth/me.) show_on_leaderboards changes are picked up by Cron — do NOT refresh here.

import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireCsrf, requireUser } from '../_lib/auth'
import type { RequestData } from '../_lib/auth'
import { toOwnProfile } from '../_lib/profiles'
import type { ProfileRow } from '../_lib/profiles'
import { nowIso } from '../_lib/time'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { firstOf } from '../_services/stats'
import {
  ADDRESS_PATTERN,
  NAME_MAX,
  deriveAddress,
  normalizeAddress,
  normalizeName,
  withSuffix,
} from '../../../packages/shared/src/address'
import { ACCENT_KEYS } from '../../../packages/shared/src/theme/palette'
import { isAvatarFace } from '../../../packages/shared/src/avatar'

interface UpdateBody {
  username?: string | null
  /** Request flag only (never stored): the client derived `username` from the name, so collisions get a silent suffix. */
  username_derived?: boolean
  display_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  /** A character from AVATAR_FACES; null returns to the one derived from the id. */
  avatar_face?: string | null
  gemini_api_key?: string | null
  home_airport?: string | null
  is_public?: boolean
  locale?: string | null
  show_on_leaderboards?: boolean
  theme_color?: string | null
  passport_publication?: 'flights' | 'all'
}

const TEXT_FIELDS = [
  'display_name',
  'bio',
  'avatar_url',
  'avatar_face',
  'gemini_api_key',
  'home_airport',
  'locale',
  'theme_color',
] as const

/** Highest numeric suffix tried before falling back to a random pilot address. */
const MAX_SUFFIX = 50

function isUniqueViolation(error: unknown): boolean {
  for (
    let e = error as { message?: unknown; cause?: unknown } | undefined, i = 0;
    e && i < 4;
    i++
  ) {
    if (typeof e.message === 'string' && e.message.includes('UNIQUE constraint failed')) return true
    e = e.cause as typeof e
  }
  return false
}

/** Candidate addresses for a derived base: the base, then `-2`…`-MAX_SUFFIX`, then random pilot ones. */
async function* addressCandidates(db: D1Database, userId: string, base: string) {
  const like = `${base.replace(/[\\%_]/g, '\\$&')}%`
  const { results } = await db
    .prepare(
      "SELECT lower(username) AS username FROM profiles WHERE lower(username) LIKE ? ESCAPE '\\' AND id != ?",
    )
    .bind(like, userId)
    .all<{ username: string }>()
  const taken = new Set(results.map((r) => r.username))
  for (let n = 1; n <= MAX_SUFFIX; n++) {
    const candidate = n === 1 ? base : withSuffix(base, n)
    if (!taken.has(candidate)) yield candidate
  }
  for (let i = 0; i < 5; i++) yield deriveAddress('')
}

export const onRequestPatch: PagesFunction<Env, string, RequestData> = (context) =>
  updateProfileRequest(context.request, context.env, context.data)

/** Request/Response entry keeps compatibility transport separate from domain writes. */
export function updateProfileRequest(
  request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)

    const body = await readJson<UpdateBody>(request)
    if (!body) throw new HttpError(400, 'Invalid request body', 'BAD_REQUEST')

    if (typeof body.bio === 'string' && body.bio.length > 140) {
      throw new HttpError(400, 'Bio must be 140 characters or fewer', 'BAD_REQUEST')
    }

    // Defense-in-depth validation for fields that reach render/fetch sinks (security hardening).
    if (
      typeof body.avatar_url === 'string' &&
      body.avatar_url.length > 0 &&
      !/^https:\/\//i.test(body.avatar_url) &&
      !/^data:image\//i.test(body.avatar_url)
    ) {
      throw new HttpError(400, 'avatar_url must be an https:// or data:image/ URL', 'BAD_REQUEST')
    }
    // Only canonical accent names are stored. null still clears the choice, kept for compatibility with earlier clients. Retired names are mapped by readers, never written.
    if (
      body.theme_color !== undefined &&
      body.theme_color !== null &&
      !(ACCENT_KEYS as readonly unknown[]).includes(body.theme_color)
    ) {
      throw new HttpError(400, 'Invalid theme_color', 'BAD_REQUEST')
    }

    if (
      body.avatar_face !== undefined &&
      body.avatar_face !== null &&
      !isAvatarFace(body.avatar_face)
    ) {
      throw new HttpError(400, 'Invalid avatar_face', 'BAD_REQUEST')
    }

    if (
      body.passport_publication !== undefined &&
      body.passport_publication !== 'flights' &&
      body.passport_publication !== 'all'
    ) {
      throw new HttpError(400, 'Invalid passport_publication', 'BAD_REQUEST')
    }

    if ('display_name' in body && typeof body.display_name === 'string') {
      body.display_name = normalizeName(body.display_name)
      if (body.display_name.length < 1 || body.display_name.length > NAME_MAX) {
        throw new HttpError(400, `Name must be 1 to ${NAME_MAX} characters`, 'INVALID_NAME')
      }
    }
    let requested: string | undefined
    if ('username' in body) {
      requested = typeof body.username === 'string' ? normalizeAddress(body.username) : ''
      if (!ADDRESS_PATTERN.test(requested)) {
        throw new HttpError(
          400,
          'Username must be 3 to 30 characters: a-z, 0-9, _ or -',
          'INVALID_USERNAME',
        )
      }
    }

    const sets: string[] = []
    const binds: unknown[] = []

    for (const field of TEXT_FIELDS) {
      if (field in body) {
        sets.push(`${field} = ?`)
        binds.push(body[field] ?? null)
      }
    }
    if ('is_public' in body) {
      sets.push('is_public = ?')
      binds.push(body.is_public ? 1 : 0)
    }
    if (body.passport_publication !== undefined) {
      sets.push('passport_publication = ?')
      binds.push(body.passport_publication)
    }
    if ('show_on_leaderboards' in body) {
      sets.push('show_on_leaderboards = ?')
      binds.push(body.show_on_leaderboards ? 1 : 0)
    }

    // Lazy address (O26): an onboarded member without one gets it derived from their name.
    let derivedBase: string | undefined = body.username_derived === true ? requested : undefined
    if (requested === undefined) {
      const stored = await env.DB.prepare(
        'SELECT username, display_name, onboarded_at FROM profiles WHERE id = ?',
      )
        .bind(user.id)
        .first<Pick<ProfileRow, 'username' | 'display_name' | 'onboarded_at'>>()
      if (stored && !stored.username && stored.onboarded_at) {
        const name = 'display_name' in body ? body.display_name : stored.display_name
        derivedBase = deriveAddress(typeof name === 'string' ? name : '')
      }
    }

    if (requested !== undefined && derivedBase === undefined) {
      const taken = await env.DB.prepare(
        'SELECT id FROM profiles WHERE lower(username) = lower(?) AND id != ? LIMIT 1',
      )
        .bind(requested, user.id)
        .first<{ id: string }>()
      if (taken) throw new HttpError(409, 'Username already taken', 'CONFLICT')
    }

    if (sets.length === 0 && requested === undefined && derivedBase === undefined) {
      throw new HttpError(400, 'No fields to update', 'BAD_REQUEST')
    }

    const editsHome = 'home_airport' in body
    // A lazy address never replaces one another request saved since the read above.
    const lazy = requested === undefined && derivedBase !== undefined
    const usernameSet = lazy ? 'username = COALESCE(username, ?)' : 'username = ?'
    const update = async (username: string | undefined) => {
      const statement = env.DB.prepare(
        `UPDATE profiles SET ${[...sets, ...(username === undefined ? [] : [usernameSet]), 'updated_at = ?'].join(', ')} WHERE id = ? RETURNING *`,
      ).bind(...binds, ...(username === undefined ? [] : [username]), nowIso(), user.id)
      return editsHome
        ? firstOf<ProfileRow>(
            (await env.DB.batch([statement, dirtyUserStatement(env.DB, user.id, true)]))[0],
          )
        : await statement.first<ProfileRow>()
    }

    let row: ProfileRow | null | undefined
    if (derivedBase === undefined) {
      try {
        row = await update(requested)
      } catch (error) {
        // Lost a race with another writer of the same address.
        if (requested !== undefined && isUniqueViolation(error)) {
          throw new HttpError(409, 'Username already taken', 'CONFLICT')
        }
        throw error
      }
    } else {
      for await (const candidate of addressCandidates(env.DB, user.id, derivedBase)) {
        try {
          row = await update(candidate)
          break
        } catch (error) {
          if (!isUniqueViolation(error)) throw error
        }
      }
      if (row === undefined) throw new HttpError(409, 'Username already taken', 'CONFLICT')
    }

    if (!row) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
    if (editsHome) await repairUserDerivedState(env.DB, user.id)
    return json(toOwnProfile(row))
  })
}
