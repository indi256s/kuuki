import { redirect } from 'next/navigation'
import { getOwnProfile } from '../../server/profile'
import { IdentitySnapshot } from '../../client/activity'
import { SettingsForm } from '../../client/account/settings-form'
import { getRequestLocale } from '../../server/locale'

export async function generateMetadata() { return { title: (await getRequestLocale()) === 'ru' ? 'Настройки — Kuuki' : 'Settings — Kuuki' } }
export default async function Settings() {
  const [own, locale] = await Promise.all([getOwnProfile(), getRequestLocale()])
  if (!own) redirect('/signin')
  return <IdentitySnapshot ownerId={own.ownerId}><SettingsForm ownerId={own.ownerId} profile={own.profile} locale={locale} /></IdentitySnapshot>
}
