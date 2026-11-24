import { redirect } from 'next/navigation'
import countries from '@kuuki/data/countries.json'

export default async function ManagePassport({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string }>
}) {
  const { countryCode } = await searchParams
  redirect(
    typeof countryCode === 'string' && Object.hasOwn(countries, countryCode)
      ? `/passport?country=${countryCode}`
      : '/passport',
  )
}
