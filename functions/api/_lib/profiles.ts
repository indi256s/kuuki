export interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  avatar_face?: string | null
  gemini_api_key: string | null
  home_airport: string | null
  is_public: number | null
  locale: string | null
  show_on_leaderboards: number | null
  theme_color: string | null
  passport_publication?: 'flights' | 'all' | null
  created_at: string | null
  updated_at: string | null
  onboarded_at?: string | null
}

export function toOwnProfile(row: ProfileRow) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    bio: row.bio,
    avatar_url: row.avatar_url,
    avatar_face: row.avatar_face ?? null,
    gemini_api_key: row.gemini_api_key,
    home_airport: row.home_airport,
    is_public: !!row.is_public,
    locale: row.locale,
    show_on_leaderboards: !!row.show_on_leaderboards,
    theme_color: row.theme_color,
    passport_publication: row.passport_publication ?? 'flights',
    created_at: row.created_at,
    updated_at: row.updated_at,
    onboarded_at: row.onboarded_at ?? null,
  }
}

export function toPublicProfile(row: ProfileRow) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    bio: row.bio,
    avatar_url: row.avatar_url,
    avatar_face: row.avatar_face ?? null,
    is_public: !!row.is_public,
    show_on_leaderboards: !!row.show_on_leaderboards,
    theme_color: row.theme_color,
    created_at: row.created_at,
  }
}

export async function getProfileRow(db: D1Database, userId: string): Promise<ProfileRow | null> {
  return db.prepare('SELECT * FROM profiles WHERE id = ?').bind(userId).first<ProfileRow>()
}
