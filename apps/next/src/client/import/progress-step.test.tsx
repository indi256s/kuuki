// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { batch, draft } from './fixtures'
import { ProgressStep } from './progress-step'

afterEach(cleanup)
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

it.each([
  [
    'en',
    'Preparing import',
    'Waiting to read',
    'Reading the document',
    'Checking flights',
    'Received',
    'Found so far: 1 flight',
  ],
  [
    'ru',
    'Готовим импорт',
    'Ожидаем распознавания',
    'Читаем документ',
    'Проверяем перелёты',
    'Получено',
    'Найдено на данный момент: 1 перелёт',
  ],
] as const)(
  'shows received progress only after admission and follows real stages (%s)',
  (locale, sending, waiting, reading, checking, received, found) => {
    const props = {
      locale,
      sourceName: 'flights.pdf',
      onCancel: vi.fn(),
      cancelling: false,
      error: null,
    }
    const { rerender } = render(<ProgressStep {...props} batch={null} drafts={[]} />)
    expect(screen.getByRole('heading', { name: sending })).toBeInTheDocument()
    expect(screen.queryByText(received)).not.toBeInTheDocument()

    rerender(
      <ProgressStep
        {...props}
        batch={batch({ status: 'processing', stage: 'accepted' })}
        drafts={[]}
      />,
    )
    expect(screen.getByRole('heading', { name: waiting })).toBeInTheDocument()
    expect(screen.getByText(received)).toBeInTheDocument()

    const drafts = [draft({ id: 'a' })]
    rerender(
      <ProgressStep
        {...props}
        batch={batch({ status: 'processing', stage: 'recognizing' })}
        drafts={drafts}
      />,
    )
    expect(screen.getByRole('heading', { name: reading })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(found)
    expect(screen.getByText('JFK → BOS')).toBeInTheDocument()

    rerender(
      <ProgressStep
        {...props}
        batch={batch({ status: 'processing', stage: 'validating' })}
        drafts={drafts}
      />,
    )
    expect(screen.getByRole('heading', { name: checking })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(found)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  },
)
