// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Alert } from './alert'

it('is a polite status unless it is urgent, and renders the action', () => {
  const { rerender } = render(
    <Alert
      variant="warning"
      title="Could not refresh"
      action={<button type="button">Try again</button>}
    >
      Showing the flights from earlier.
    </Alert>,
  )
  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Could not refresh')
  expect(status).toHaveTextContent('Showing the flights from earlier.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  rerender(<Alert variant="danger" title="Could not save" urgent />)
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
