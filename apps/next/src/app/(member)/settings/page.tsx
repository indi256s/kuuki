import { requireOnboardedMember } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { IdentitySnapshot } from '../../../client/activity'
import { SettingsForm } from '../../../client/account/settings-form'
import { getRequestLocale } from '../../../server/locale'

export const generateMetadata = () => pageMetadata('Settings', 'Настройки')
export default async function Settings() {
  const [own, locale] = await Promise.all([requireOnboardedMember(), getRequestLocale()])
  return <IdentitySnapshot ownerId={own.ownerId}><SettingsForm ownerId={own.ownerId} profile={own.profile} locale={locale} /></IdentitySnapshot>
}
