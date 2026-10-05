import { redirect } from 'next/navigation'
import { requireOnboardedMember } from '../../../../server/gates'
import { pageMetadata } from '../../../../server/metadata'
import { getRequestLocale } from '../../../../server/locale'
import { IdentitySnapshot } from '../../../../client/activity'
import { PassportManage } from '../../../../client/capture/passport-manage'
import countries from '@kuuki/data/countries.json'

export const generateMetadata = () => pageMetadata('Aircraft in journal', 'Самолёты в журнале')
export default async function ManagePassport({ searchParams }: { searchParams: Promise<{ countryCode?: string }> }) {
  const [own, locale, params] = await Promise.all([requireOnboardedMember(), getRequestLocale(), searchParams])
  const identity = { id: own.ownerId }
  // Countries are managed in Passport's sheets; a legacy link carrying a catalogue code lands on that country's sheet.
  if (typeof params.countryCode === 'string' && Object.hasOwn(countries, params.countryCode)) redirect(`/passport?country=${params.countryCode}`)
  return <IdentitySnapshot ownerId={identity.id}><div className="page-heading"><p className="eyebrow">{locale === 'ru' ? 'Паспорт' : 'Passport'}</p><h1>{locale === 'ru' ? 'Самолёты в журнале' : 'Aircraft in journal'}</h1></div><PassportManage ownerId={identity.id} locale={locale} /></IdentitySnapshot>
}
