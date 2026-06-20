// Profile reads + DTO mappers. SQLite stores booleans as 0/1; the API returns real booleans
// so the frontend shape matches the old Supabase rows. Public responses use a strict column
// allowlist — gemini_api_key (and other private fields) must never leave via public endpoints.

export interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  gemini_api_key: string | null
  home_airport: string | null
  is_public: number | null
  locale: string | null
  show_on_leaderboards: number | null
  theme_color: string | null
  created_at: string | null
  updated_at: string | null
}

/** Full profile (own view) — booleans coerced; includes private fields. */
export function toOwnProfile(row: ProfileRow) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    bio: row.bio,
    avatar_url: row.avatar_url,
    gemini_api_key: row.gemini_api_key,
    home_airport: row.home_airport,
    is_public: !!row.is_public,
    locale: row.locale,
    show_on_leaderboards: !!row.show_on_leaderboards,
    theme_color: row.theme_color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** Public view — explicit allowlist, NEVER gemini_api_key / home_airport / locale. */
export function toPublicProfile(row: ProfileRow) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    bio: row.bio,
    avatar_url: row.avatar_url,
    is_public: !!row.is_public,
    show_on_leaderboards: !!row.show_on_leaderboards,
    theme_color: row.theme_color,
    created_at: row.created_at,
  }
}

export async function getProfileRow(db: D1Database, userId: string): Promise<ProfileRow | null> {
  return db.prepare('SELECT * FROM profiles WHERE id = ?').bind(userId).first<ProfileRow>()
}
