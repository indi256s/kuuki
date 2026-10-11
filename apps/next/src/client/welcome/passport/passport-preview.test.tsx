// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PassportPreview as Preview } from '../types'
import { PassportPreview, mrzLine } from './passport-preview'

const base: Preview = {
  step: 'name',
  name: '',
  found: { flights: 0, countries: [] },
  open: false,
}

afterEach(() => vi.useRealTimers())

describe('PassportPreview', () => {
  it('prints the name on the cover, with a placeholder while empty', () => {
    const { container, rerender } = render(<PassportPreview preview={base} />)
    const name = () => container.querySelector('.wp-cover-name') as HTMLElement
    expect(name()).toHaveTextContent('Your name')
    expect(name()).toHaveAttribute('data-empty')
    rerender(<PassportPreview preview={{ ...base, name: ' Alex   Mor ' }} />)
    expect(name()).toHaveTextContent('Alex Mor')
    expect(name()).not.toHaveAttribute('data-empty')
    expect(name()).toHaveAttribute('dir', 'auto')
  })

  it('steps the cover name down for long names', () => {
    const { container } = render(
      <PassportPreview preview={{ ...base, name: 'Alexandra Konstantinopolskaya-Vandenberghe' }} />,
    )
    expect(container.querySelector('.wp-cover-name')).toHaveAttribute('data-size', 'xs')
  })

  it('review: one aria-hidden stamp per country, the stats and the plural caption', () => {
    const preview: Preview = {
      step: 'review',
      name: 'Alex Mor',
      open: true,
      found: {
        flights: 41,
        countries: ['JP', 'PT', 'GE', 'TR', 'DE', 'GB'],
        km: 182410,
        since: 2016,
      },
    }
    const { container } = render(<PassportPreview preview={preview} />)
    const stamps = container.querySelectorAll('.wp-stamp')
    expect(stamps).toHaveLength(6)
    stamps.forEach((stamp) => expect(stamp).toHaveAttribute('aria-hidden', 'true'))
    const spread = container.querySelector('.wp-spread') as HTMLElement
    expect(within(spread).getByText('41')).toBeInTheDocument()
    expect(within(spread).getByText(/182[,\s]410/)).toBeInTheDocument()
    expect(within(spread).getByText('2016')).toBeInTheDocument()
    expect(screen.getByText('6 countries. The passport grows with you.')).toBeInTheDocument()
  })

  it('review omits stats it does not know', () => {
    const { container } = render(
      <PassportPreview
        preview={{ step: 'review', name: 'A', open: true, found: { flights: 2, countries: [] } }}
      />,
    )
    expect(container.textContent).not.toContain('DISTANCE')
    expect(container.textContent).not.toContain('SINCE')
  })

  it('ready: the WELCOME stamp has fixed English text and today’s date', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 11, 12))
    const { container } = render(
      <PassportPreview
        locale="ru"
        preview={{
          step: 'ready',
          name: 'Alex',
          open: false,
          found: { flights: 3, countries: ['JP'] },
        }}
      />,
    )
    const entry = container.querySelector('.wp-entry') as HTMLElement
    expect(entry).toHaveTextContent('KUUKI · ENTRY')
    expect(entry).toHaveTextContent('WELCOME')
    expect(entry).toHaveTextContent('11 OCT 2026')
    expect(
      screen.getByText('Штамп поставлен. Карточка растворится в вашем журнале.'),
    ).toBeInTheDocument()
  })

  it('builds a Latin MRZ line and falls back to filler for other scripts', () => {
    expect(mrzLine('Alex Morgan')).toBe('P<KUU<MORGAN<<ALEX<<<<')
    expect(mrzLine('田中美咲')).toHaveLength(22)
    expect(mrzLine('田中美咲')).toMatch(/^P<KUU<+$/)
  })
})
