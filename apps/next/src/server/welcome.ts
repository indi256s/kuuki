import 'server-only'
import { getRequestEnv } from './identity'

export const WELCOME_STEPS = ['name', 'flights', 'review', 'ready'] as const
export type WelcomeStep = (typeof WELCOME_STEPS)[number]

export const isWelcomeStep = (value: unknown): value is WelcomeStep =>
  typeof value === 'string' && (WELCOME_STEPS as readonly string[]).includes(value)

export const welcomePath = (step: WelcomeStep, batch?: string | null) =>
  batch ? `/welcome/${step}?batch=${encodeURIComponent(batch)}` : `/welcome/${step}`

/** Where an unfinished member picks the card back up (spec O4), with the batch it belongs to. */
export type WelcomeResume = { step: WelcomeStep; batch: string | null; reading: boolean }

type ResumeProfile = { display_name: string | null }

/**
 * `name` until there is a name; then the newest unexpired batch decides: still `processing` → the flights step
 * reading it, drafts left to review → review. Saved flights with nothing open → the reveal. Otherwise flights.
 */
export async function getWelcomeResume(
  userId: string,
  profile: ResumeProfile,
): Promise<WelcomeResume> {
  if (!profile.display_name?.trim()) return { step: 'name', batch: null, reading: false }
  const { DB } = await getRequestEnv()
  const now = new Date().toISOString()
  const batch = await DB.prepare(
    `SELECT b.id, b.status,
            EXISTS (SELECT 1 FROM import_drafts d WHERE d.batch_id = b.id AND d.user_id = b.user_id AND d.status = 'review') AS open_drafts
       FROM import_batches b
      WHERE b.user_id = ? AND b.expires_at > ? AND b.status IN ('processing', 'review', 'partial')
      ORDER BY b.created_at DESC
      LIMIT 1`,
  )
    .bind(userId, now)
    .first<{ id: string; status: string; open_drafts: number }>()
  if (batch?.status === 'processing') return { step: 'flights', batch: batch.id, reading: true }
  if (batch?.open_drafts) return { step: 'review', batch: batch.id, reading: false }
  const flight = await DB.prepare('SELECT 1 AS present FROM flights WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first()
  return { step: flight ? 'ready' : 'flights', batch: null, reading: false }
}

/** Whether `batch` is the member's own, unexpired and in the given states. */
export async function ownsOpenBatch(userId: string, batch: string, statuses: string[]) {
  const { DB } = await getRequestEnv()
  return !!(await DB.prepare(
    `SELECT 1 AS present FROM import_batches WHERE id = ? AND user_id = ? AND expires_at > ? AND status IN (${statuses.map(() => '?').join(', ')})`,
  )
    .bind(batch, userId, new Date().toISOString(), ...statuses)
    .first())
}
