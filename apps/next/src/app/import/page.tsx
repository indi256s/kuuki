import { redirect } from 'next/navigation'
import { getRequestIdentity } from '../../server/identity'
import { getRequestLocale } from '../../server/locale'
import { IdentitySnapshot } from '../../client/activity'
import { ImportClient } from '../../client/import/import-client'
import './import.css'

export default async function Import({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const [identity, locale, params] = await Promise.all([getRequestIdentity(), getRequestLocale(), searchParams])
  if (!identity) redirect('/signin')
  return <IdentitySnapshot ownerId={identity.id}><ImportClient ownerId={identity.id} locale={locale} initialDraftId={params.draft} /></IdentitySnapshot>
}
