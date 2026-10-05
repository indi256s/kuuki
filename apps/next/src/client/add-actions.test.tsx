// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddActions, ADD_ACTIONS } from './add-actions'
import { Menu } from './ui/menu'

describe('AddActions', () => {
  it('lists upload, paste and manual with their destinations', () => {
    expect(ADD_ACTIONS.map(action => [action.id, action.href])).toEqual([['upload', '/import?source=file'], ['paste', '/import?source=text'], ['manual', '/add']])
  })

  it('renders the sheet variant as three links and reports navigation', async () => {
    const onNavigate = vi.fn()
    render(<AddActions variant="sheet" onNavigate={onNavigate} />)
    const links = screen.getAllByRole('link')
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/import?source=file', '/import?source=text', '/add'])
    links[0].addEventListener('click', event => event.preventDefault())
    await userEvent.click(links[0])
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('renders the same destinations as menu items inside a Menu', async () => {
    render(<Menu trigger={<button type="button">More</button>}><AddActions variant="menu" /></Menu>)
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map(item => item.getAttribute('href'))).toEqual(['/import?source=file', '/import?source=text', '/add'])
  })
})
