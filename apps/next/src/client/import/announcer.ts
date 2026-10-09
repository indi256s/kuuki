// Decides when the live region may speak while recognition runs: every stage change at once, found-count changes
// at most once per interval, and the last held count when the interval ends. Pure and clock-injected.
export interface Progress {
  stage: string | null
  found: number
}
export interface Announcement {
  stage: string | null
  found?: number
}

export class Announcer {
  private stage: string | null | undefined
  private spokenFound = -1
  private lastCountAt = -Infinity
  private held: Progress | null = null
  constructor(private interval = 3000) {}

  next(progress: Progress, now: number): Announcement | null {
    if (progress.stage !== this.stage) {
      this.stage = progress.stage
      this.held = null
      // A stage change carries the count only when there is something to say about it.
      if (progress.found > 0) {
        this.spokenFound = progress.found
        this.lastCountAt = now
        return { stage: progress.stage, found: progress.found }
      }
      this.spokenFound = Math.max(this.spokenFound, 0)
      return { stage: progress.stage }
    }
    if (progress.found === this.spokenFound) {
      this.held = null
      return null
    }
    if (now - this.lastCountAt >= this.interval) {
      this.spokenFound = progress.found
      this.lastCountAt = now
      this.held = null
      return { stage: progress.stage, found: progress.found }
    }
    this.held = progress
    return null
  }

  /** Milliseconds until a held count may be spoken, or null when nothing is held. */
  dueIn(now: number): number | null {
    return this.held ? Math.max(0, this.lastCountAt + this.interval - now) : null
  }

  flush(now: number): Announcement | null {
    if (!this.held) return null
    return this.next(this.held, Math.max(now, this.lastCountAt + this.interval))
  }
}
