// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import Onboarding from '../../app/(entry)/onboarding/page'
const own = { ownerId: 'a', profile: { username: 'traveler', display_name: 'Alex' } }
const gates = vi.hoisted(() => ({ getGateProfile: vi.fn(), hasSavedFlight: vi.fn() }))
vi.mock('../../server/gates', () => gates)
vi.mock('../../server/profile', () => ({ getProfileShareUrl: async (username: string) => `https://configured.example/fly/${username}` }))
vi.mock('../../server/locale', () => ({ getRequestLocale: async () => 'en' }))
vi.mock('../../server/metadata', () => ({ pageMetadata: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw Error(`redirect:${url}`) } }))
vi.mock('../activity', () => ({ IdentitySnapshot: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('./onboarding-name', () => ({ OnboardingName: ({ profileUrl }: { profileUrl: string }) => <p>{profileUrl}</p> }))
vi.mock('./onboarding-flow', () => ({ OnboardingFlow: ({ step, batchId }: { step: string; batchId: string }) => <p>{step} {batchId}</p> }))
beforeEach(() => { gates.getGateProfile.mockReset().mockResolvedValue(own); gates.hasSavedFlight.mockReset().mockResolvedValue(false) })
it('redirects guests before probing their canonical flights', async () => {
  gates.getGateProfile.mockResolvedValue(null)
  await expect(Onboarding({ searchParams: Promise.resolve({ step: 'reveal' }) })).rejects.toThrow('redirect:/signin')
  expect(gates.hasSavedFlight).not.toHaveBeenCalled()
})
it('gates Reveal on a real saved flight and preserves its onboarding batch namespace', async () => {
  const batch = '11111111-1111-4111-8111-111111111111'
  await expect(Onboarding({ searchParams: Promise.resolve({ step: 'reveal', batch }) })).rejects.toThrow(`redirect:/onboarding?batch=${batch}&step=capture`)
  gates.hasSavedFlight.mockResolvedValue(true)
  render(await Onboarding({ searchParams: Promise.resolve({ step: 'reveal', batch }) }))
  expect(screen.getByText(`reveal ${batch}`)).toBeVisible()
})
it('passes the configured real public address to Name and labels all three steps', async () => {
  render(await Onboarding({ searchParams: Promise.resolve({ step: 'name' }) }))
  expect(screen.getByText('https://configured.example/fly/traveler')).toBeVisible()
  expect(screen.getByRole('list', { name: 'Getting started steps' })).toHaveTextContent('Name')
  expect(screen.getByRole('list', { name: 'Getting started steps' })).toHaveTextContent('Capture')
  expect(screen.getByRole('list', { name: 'Getting started steps' })).toHaveTextContent('Reveal')
})
