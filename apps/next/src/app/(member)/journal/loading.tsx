import { LedgerSkeleton } from '../../../client/journal/ledger-skeleton'
import { getRequestLocale } from '../../../server/locale'

export default async function Loading() {
  return <LedgerSkeleton locale={await getRequestLocale()} />
}
