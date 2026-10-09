import { redirect } from 'next/navigation'
import { requireOnboardedMember } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { normalizeImportQuery, withQuery } from '../../../lib/url-state'
import { getRequestLocale } from '../../../server/locale'
import { IdentitySnapshot } from '../../../client/activity'
import { ImportClient } from '../../../client/import/import-client'
import './import.css'

export const generateMetadata = () => pageMetadata('Import flights', 'Импорт перелётов')
export default async function Import({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [own, locale, params] = await Promise.all([
    requireOnboardedMember(),
    getRequestLocale(),
    searchParams,
  ])
  const identity = { id: own.ownerId }
  const normalized = normalizeImportQuery(params)
  if (!normalized.canonical) redirect(withQuery('/import', normalized.query))
  return (
    <IdentitySnapshot ownerId={identity.id}>
      <ImportClient
        ownerId={identity.id}
        locale={locale}
        initialBatchId={normalized.state.batch}
        initialSource={normalized.state.source}
      />
    </IdentitySnapshot>
  )
}
