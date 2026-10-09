'use client'
// Temporary Journal shell: the page heading (RouteFocus focuses `main h1`) and a plain list of the store's ledger
// items, so the page works end to end. The ledger, toolbar and sheet tickets replace the list.
import type { Locale } from '../../server/locale'
import { formatDateOnly } from '../../lib/format'
import { useJournalSelection } from './store'

export function JournalShell({ locale }: { locale: Locale }) {
  const selection = useJournalSelection()
  return <section data-testid="journal-data" className="journal-data read-stack">
    <div className="page-heading"><h1>{locale === 'ru' ? 'Журнал' : 'Journal'}</h1></div>
    <ol>{selection.items.map(item => item.kind === 'flight'
      ? <li key={item.flight.id}>{item.flight.origin} → {item.flight.destination}, {formatDateOnly(locale, item.flight.date)}</li>
      : null)}</ol>
  </section>
}
