import { requireOnboardedMember } from '../../../../server/gates'
import { pageMetadata } from '../../../../server/metadata'
import { getRequestLocale } from '../../../../server/locale'
import { IdentitySnapshot } from '../../../../client/activity'
import { PassportManage } from '../../../../client/capture/passport-manage'
import countries from '@kuuki/data/countries.json'

export const generateMetadata = () => pageMetadata('Manage places and aircraft', 'Места и самолёты')
export default async function ManagePassport({ searchParams }: { searchParams: Promise<{ countryCode?: string }> }) {
  const [own, locale, params] = await Promise.all([requireOnboardedMember(), getRequestLocale(), searchParams])
  const identity = { id: own.ownerId }
  const initialCountry = typeof params.countryCode === 'string' && Object.hasOwn(countries, params.countryCode) ? params.countryCode : ''
  return <IdentitySnapshot ownerId={identity.id}><div className="page-heading"><p className="eyebrow">{locale === 'ru' ? 'Паспорт' : 'Passport'}</p><h1>{locale === 'ru' ? 'Места и самолёты' : 'Manage places and aircraft'}</h1></div><PassportManage ownerId={identity.id} locale={locale} initialCountry={initialCountry} /></IdentitySnapshot>
}
