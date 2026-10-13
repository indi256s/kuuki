// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AircraftAnnouncement } from './aircraft-announcement'

it('announces only the latest aircraft run, politely after a save and assertively otherwise', () => {
  const { rerender } = render(<AircraftAnnouncement locale="en" counts={null} />)
  const status = screen.getByRole('status')
  const alert = screen.getByRole('alert')
  expect(status).toBeEmptyDOMElement()
  expect(alert).toBeEmptyDOMElement()

  rerender(<AircraftAnnouncement locale="en" counts={{ saved: 0, failed: 2, uncertain: 0 }} />)
  expect(alert).toHaveTextContent('Not saved: 2')
  expect(status).toBeEmptyDOMElement()
  rerender(<AircraftAnnouncement locale="ru" counts={{ saved: 0, failed: 2, uncertain: 0 }} />)
  expect(alert).toHaveTextContent('Не сохранено: 2')

  rerender(
    <AircraftAnnouncement
      locale="en"
      counts={{ saved: 1, failed: 1, uncertain: 1 }}
      status="Totals updated."
    />,
  )
  expect(status).toHaveTextContent('Saved: 1 · Not saved: 1 · May not be saved: 1')
  expect(status).toHaveTextContent('Totals updated.')
  expect(alert).toBeEmptyDOMElement()

  rerender(<AircraftAnnouncement locale="en" counts={null} />)
  expect(status).toBeEmptyDOMElement()
  expect(alert).toBeEmptyDOMElement()
  rerender(<AircraftAnnouncement locale="en" counts={{ saved: 0, failed: 0, uncertain: 1 }} />)
  expect(alert).toHaveTextContent('May not be saved: 1. We did not get an answer')
  expect(status).toBeEmptyDOMElement()
  const first = alert.textContent
  rerender(<AircraftAnnouncement locale="en" counts={null} />)
  expect(alert).toBeEmptyDOMElement()
  rerender(<AircraftAnnouncement locale="en" counts={{ saved: 0, failed: 0, uncertain: 1 }} />)
  expect(alert.textContent).toBe(first)
  expect(screen.getByRole('alert')).toBe(alert)
  expect(screen.getByRole('status')).toBe(status)
})
