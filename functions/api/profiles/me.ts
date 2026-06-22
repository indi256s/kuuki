// PATCH /api/profiles/me — update the authenticated user's profile. Only provided fields are
// written. Username uniqueness is enforced case-insensitively. (GET own profile lives at
// /api/auth/me.) show_on_leaderboards changes are picked up by Cron — do NOT refresh here.

import { runHandler, json, readJson, HttpError } from '../_lib/http'
import { requireCsrf, requireUser } from '../_lib/auth'
import type { RequestData } from '../_lib/auth'
import { toOwnProfile } from '../_lib/profiles'
import type { ProfileRow } from '../_lib/profiles'
import { nowIso } from '../_lib/time'

interface UpdateBody {
  username?: string | null
  display_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  gemini_api_key?: string | null
  home_airport?: string | null
  is_public?: boolean
  locale?: string | null
  show_on_leaderboards?: boolean
  theme_color?: string | null
}

const TEXT_FIELDS = [
  'username',
  'display_name',
  'bio',
  'avatar_url',
  'gemini_api_key',
  'home_airport',
  'locale',
  'theme_color',
] as const

export const onRequestPatch: PagesFunction<Env, string, RequestData> = (context) =>
  runHandler(async () => {
    const { request, env } = context
    requireCsrf(request)
    const user = requireUser(context.data)

    const body = await readJson<UpdateBody>(request)
    if (!body) throw new HttpError(400, 'Invalid request body', 'BAD_REQUEST')

    if (typeof body.bio === 'string' && body.bio.length > 140) {
      throw new HttpError(400, 'Bio must be 140 characters or fewer', 'BAD_REQUEST')
    }

    // Defense-in-depth validation for fields that reach render/fetch sinks (security hardening).
    if (
      typeof body.avatar_url === 'string' && body.avatar_url.length > 0 &&
      !/^https:\/\//i.test(body.avatar_url) && !/^data:image\//i.test(body.avatar_url)
    ) {
      throw new HttpError(400, 'avatar_url must be an https:// or data:image/ URL', 'BAD_REQUEST')
    }
    if (
      typeof body.theme_color === 'string' && body.theme_color.length > 0 &&
      !/^[a-zA-Z0-9#_-]{1,32}$/.test(body.theme_color)
    ) {
      throw new HttpError(400, 'Invalid theme_color', 'BAD_REQUEST')
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
    if ('show_on_leaderboards' in body) {
      sets.push('show_on_leaderboards = ?')
      binds.push(body.show_on_leaderboards ? 1 : 0)
    }

    if ('username' in body && body.username) {
      const taken = await env.DB.prepare(
        'SELECT id FROM profiles WHERE lower(username) = lower(?) AND id != ? LIMIT 1'
      )
        .bind(body.username, user.id)
        .first<{ id: string }>()
      if (taken) throw new HttpError(409, 'Username already taken', 'CONFLICT')
    }

    if (sets.length === 0) throw new HttpError(400, 'No fields to update', 'BAD_REQUEST')

    sets.push('updated_at = ?')
    binds.push(nowIso())
    binds.push(user.id)

    const row = await env.DB.prepare(
      `UPDATE profiles SET ${sets.join(', ')} WHERE id = ? RETURNING *`
    )
      .bind(...binds)
      .first<ProfileRow>()

    if (!row) throw new HttpError(404, 'Profile not found', 'NOT_FOUND')
    return json(toOwnProfile(row))
  })
