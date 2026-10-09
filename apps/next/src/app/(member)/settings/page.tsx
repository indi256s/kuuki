import { requireOnboardedMember } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { IdentitySnapshot } from '../../../client/activity'
import { SettingsForm } from '../../../client/account/settings-form'
import { getRequestEnv } from '../../../server/identity'
import type { SettingsCounts } from '../../../client/account/settings-data'
import { getRequestLocale } from '../../../server/locale'

export const generateMetadata = () => pageMetadata('Settings', 'Настройки')
export default async function Settings() {
  const [own, locale] = await Promise.all([requireOnboardedMember(), getRequestLocale()])
  let counts: SettingsCounts | null = null
  try {
    const env = await getRequestEnv()
    counts = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM flights WHERE user_id = ?) AS flights,
      COALESCE((SELECT total_flights FROM user_stats WHERE user_id = ?), 0) AS completed,
      (SELECT COUNT(*) FROM country_claims WHERE user_id = ?) AS claims,
      (SELECT COUNT(*) FROM ground_visits WHERE user_id = ?) AS ground,
      (SELECT COUNT(*) FROM import_drafts WHERE user_id = ?) AS drafts`)
      .bind(own.ownerId, own.ownerId, own.ownerId, own.ownerId, own.ownerId)
      .first<SettingsCounts>()
  } catch {
    /* Keep Settings usable; unavailable counts must never become an empty account. */
  }
  return (
    <IdentitySnapshot ownerId={own.ownerId}>
      <SettingsForm
        key={own.ownerId}
        ownerId={own.ownerId}
        profile={own.profile}
        locale={locale}
        counts={counts}
      />
    </IdentitySnapshot>
  )
}
