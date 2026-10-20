// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { CONCORDE } from './concorde.generated'
import type { TurnController } from './turn.generated.js'

vi.mock('./gl.generated.js', async (original) => ({
  ...(await original<typeof import('./gl.generated.js')>()),
  glLayer: () => ({ gl: { getParameter: () => 256 }, set() {}, draw() {}, clear() {} }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

it('keeps a launched burn lit for its hold on a parked model', async () => {
  vi.stubGlobal('WebGLRenderingContext', class {})
  const { mountReheat } = await import('./reheat')
  const stage = document.createElement('div')
  stage.innerHTML = '<canvas class="cn-reheat"></canvas>'
  const controller = {
    anchor: () => ({ world: [0, 0, 0], screen: [0, 0], direction: [0, 0, -1] }),
    cams: () => ({ world: { V: [0, 0, 1] } }),
  } as unknown as TurnController
  const flame = mountReheat(stage, controller, CONCORDE.reheat)!
  flame.launch()
  // A parked model never reports `turning`; the turn's own burns would go out on the first step.
  for (let frame = 0; frame < 40; frame++) expect(flame.step(0.1, false)).toBe(true)
  let out = 0
  while (flame.step(0.1, false) && out < 100) out++
  // After the 4.2 s hold it spools down and goes out.
  expect(out).toBeLessThan(60)
})
