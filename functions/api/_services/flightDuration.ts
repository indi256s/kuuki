const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 86_400_000
const ARRIVAL_DAY_OFFSETS = [-1, 0, 1, 2] as const
const MAX_INFERRED_MINUTES = 1440

function localWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  let utc = asUtc - tzOffsetMs(asUtc, timeZone)
  utc = asUtc - tzOffsetMs(utc, timeZone)
  return new Date(utc)
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asIfUtc - utcMs
}

function parseDate(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function parseTime(time: string): [number, number, number] | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0]
}

export interface ComputeFlightDurationInput {
  date: string
  departureTime: string | null
  arrivalTime: string | null
  originTz: string | null
  destTz: string | null
  existingDurationMinutes: number | null
}

export interface ComputeFlightDurationResult {
  departureUtc: string | null
  arrivalUtc: string | null
  durationMinutes: number | null
}

export function computeFlightDuration(
  input: ComputeFlightDurationInput,
): ComputeFlightDurationResult {
  const { date, departureTime, arrivalTime, originTz, destTz, existingDurationMinutes } = input

  if (!date || !departureTime || !arrivalTime || !originTz || !destTz) {
    return { departureUtc: null, arrivalUtc: null, durationMinutes: existingDurationMinutes }
  }

  const d = parseDate(date)
  const dep = parseTime(departureTime)
  const arr = parseTime(arrivalTime)
  if (!d || !dep || !arr) {
    return { departureUtc: null, arrivalUtc: null, durationMinutes: existingDurationMinutes }
  }
  const [y, mo, day] = d

  const depUtc = localWallClockToUtc(y, mo, day, dep[0], dep[1], dep[2], originTz)
  if (Number.isNaN(depUtc.getTime())) {
    return { departureUtc: null, arrivalUtc: null, durationMinutes: existingDurationMinutes }
  }

  let best: { arrival: Date; minutes: number } | null = null
  for (const offset of ARRIVAL_DAY_OFFSETS) {
    const arrivalDate = new Date(Date.UTC(y, mo - 1, day) + offset * MS_PER_DAY)
    const arrival = localWallClockToUtc(
      arrivalDate.getUTCFullYear(),
      arrivalDate.getUTCMonth() + 1,
      arrivalDate.getUTCDate(),
      arr[0],
      arr[1],
      arr[2],
      destTz,
    )
    if (Number.isNaN(arrival.getTime())) {
      return { departureUtc: null, arrivalUtc: null, durationMinutes: existingDurationMinutes }
    }
    const minutes = (arrival.getTime() - depUtc.getTime()) / MS_PER_MINUTE
    if (
      minutes > 0 &&
      minutes <= MAX_INFERRED_MINUTES &&
      (best === null || minutes < best.minutes)
    ) {
      best = { arrival, minutes }
    }
  }

  return {
    departureUtc: depUtc.toISOString(),
    arrivalUtc: best ? best.arrival.toISOString() : null,
    durationMinutes: best ? pgRound(best.minutes) : existingDurationMinutes,
  }
}

function pgRound(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}
