import { describe, expect, it } from 'vitest'
import { Announcer } from './announcer'

describe('Announcer', () => {
  it('announces each new stage at once', () => {
    const a = new Announcer(3000)
    expect(a.next({ stage: 'accepted', found: 0 }, 0)).toEqual({ stage: 'accepted' })
    expect(a.next({ stage: 'accepted', found: 0 }, 10)).toBeNull()
    expect(a.next({ stage: 'recognizing', found: 0 }, 20)).toEqual({ stage: 'recognizing' })
  })

  it('does not repeat a count that is already announced', () => {
    const a = new Announcer(3000)
    a.next({ stage: 'recognizing', found: 0 }, 0)
    expect(a.next({ stage: 'recognizing', found: 2 }, 100)).toEqual({ stage: 'recognizing', found: 2 })
    expect(a.next({ stage: 'recognizing', found: 2 }, 200)).toBeNull()
  })

  it('holds back rapid count changes and reports when the held one is due', () => {
    const a = new Announcer(3000)
    a.next({ stage: 'recognizing', found: 1 }, 0)
    expect(a.next({ stage: 'recognizing', found: 2 }, 500)).toBeNull()
    expect(a.next({ stage: 'recognizing', found: 5 }, 1000)).toBeNull()
    expect(a.dueIn(1000)).toBe(2000)
    expect(a.flush(3000)).toEqual({ stage: 'recognizing', found: 5 })
    expect(a.dueIn(3000)).toBeNull()
  })

  it('announces the final count immediately when the stage moves on', () => {
    const a = new Announcer(3000)
    a.next({ stage: 'recognizing', found: 1 }, 0)
    expect(a.next({ stage: 'recognizing', found: 4 }, 100)).toBeNull()
    expect(a.next({ stage: 'review_ready', found: 4 }, 200)).toEqual({ stage: 'review_ready', found: 4 })
  })
})
