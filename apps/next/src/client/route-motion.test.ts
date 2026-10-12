import { describe, expect, it } from 'vitest'
import { clock, cubicBezier } from './route-motion'

describe('clock', () => {
  it('reaches its target in its duration, not on an exponential tail', () => {
    const integrator = clock(200)
    let state = { position: 0, velocity: 0 }
    let frames = 0
    while (!integrator.isSettled(state, 1) && frames < 100) {
      state = integrator.step(state, 1, 1 / 60)
      frames++
    }
    expect(frames).toBe(12)
  })
})

describe('cubicBezier', () => {
  it('matches the --ease-out curve at its ends and stays monotonic', () => {
    const ease = cubicBezier(0.23, 1, 0.32, 1)
    const samples = Array.from({ length: 11 }, (_, i) => ease(i / 10))
    expect(samples[0]).toBe(0)
    expect(samples[10]).toBe(1)
    expect(samples.every((value, i) => i === 0 || value >= samples[i - 1])).toBe(true)
    expect(ease(0.5)).toBeGreaterThan(0.9)
  })
})
