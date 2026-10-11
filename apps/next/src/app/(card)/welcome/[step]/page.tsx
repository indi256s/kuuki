import { redirect } from 'next/navigation'
import { IdentitySnapshot } from '../../../../client/activity'
import { AuthCard } from '../../../../client/auth-card/auth-card'
import { pickTagline } from '../../../../client/auth-card/taglines'
import { getGateProfile } from '../../../../server/gates'
import { getRequestEnv } from '../../../../server/identity'
import { getRequestLocale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'
import {
  getWelcomeResume,
  isWelcomeStep,
  ownsOpenBatch,
  welcomePath,
  type WelcomeResume,
} from '../../../../server/welcome'

export const generateMetadata = () => pageMetadata('Welcome', 'Добро пожаловать')

const BATCH = /^[0-9a-f-]{36}$/

/**
 * The card's onboarding steps. A document load lands where the member's progress allows: the name first; a running
 * or finished batch wins over the prompt; review needs drafts and the reveal needs saved flights. In-card moves
 * between steps are history pushes and never reach this page.
 */
export default async function Welcome({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ step }, query, own, locale] = await Promise.all([
    params,
    searchParams,
    getGateProfile(),
    getRequestLocale(),
  ])
  if (!own) redirect('/signin')
  if (own.profile.onboarded_at) redirect('/overview')
  const resume = await getWelcomeResume(own.ownerId, own.profile)
  const toResume = (at: WelcomeResume) => redirect(welcomePath(at.step, at.batch))
  if (!isWelcomeStep(step)) toResume(resume)
  const asked = typeof query.batch === 'string' && BATCH.test(query.batch) ? query.batch : null
  const manual = query.manual === '1'
  let batch: string | null = null
  if (resume.step === 'name' && step !== 'name') toResume(resume)
  if (step === 'flights') {
    if (resume.step === 'review' || resume.step === 'ready' || resume.reading) {
      if (asked !== resume.batch || resume.step !== 'flights') toResume(resume)
    }
    batch = resume.reading ? resume.batch : null
  }
  if (step === 'review') {
    batch =
      asked && (await ownsOpenBatch(own.ownerId, asked, ['review', 'partial', 'completed']))
        ? asked
        : resume.step === 'review'
          ? resume.batch
          : null
    if (!batch) toResume(resume)
    if (batch !== asked) redirect(welcomePath('review', batch))
  }
  const env = await getRequestEnv()
  let saved = null
  if (step === 'ready') {
    const { DB } = env
    const rows = (
      await DB.prepare(
        'SELECT date, origin, destination, is_upcoming FROM flights WHERE user_id = ? ORDER BY date',
      )
        .bind(own.ownerId)
        .all<{ date: string; origin: string; destination: string; is_upcoming: number }>()
    ).results
    if (!rows.length) toResume(resume)
    saved = rows.map((row) => ({
      date: row.date,
      origin: row.origin,
      destination: row.destination,
      upcoming: !!row.is_upcoming,
    }))
  }
  return (
    <IdentitySnapshot ownerId={own.ownerId}>
      <AuthCard
        locale={locale}
        tagline={pickTagline()}
        welcome={{
          ownerId: own.ownerId,
          step: step as 'name' | 'flights' | 'review' | 'ready',
          displayName: own.profile.display_name ?? '',
          username: own.profile.username,
          batch,
          manual: step === 'flights' && manual && !batch,
          saved,
          jobs: Boolean((env as { IMPORT_JOBS?: unknown }).IMPORT_JOBS),
        }}
      />
    </IdentitySnapshot>
  )
}
