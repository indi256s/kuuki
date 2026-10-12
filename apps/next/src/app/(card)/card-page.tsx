import 'server-only'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '../../client/auth-card/auth-card'
import { pickTagline } from '../../client/auth-card/taglines'
import { getMemberLanding } from '../../server/gates'
import { getRequestEnv } from '../../server/identity'
import { getRequestLocale } from '../../server/locale'

/** `/`, `/signin` and `/signup` share one title; the two aliases point their canonical link at `/`. */
export async function cardMetadata({ canonical }: { canonical: boolean }): Promise<Metadata> {
  const title =
    (await getRequestLocale()) === 'ru' ? 'Kuuki — журнал перелётов' : 'Kuuki — flight journal'
  if (!canonical) return { title }
  const { PAGES_ORIGIN } = await getRequestEnv()
  return { title, alternates: { canonical: new URL('/', PAGES_ORIGIN).href } }
}

/** Members go straight to their journal; everyone else gets the card. A tagline is picked once per page load. */
export async function CardPage({
  initialEmail = '',
  initialNotice,
  initialError,
}: {
  initialEmail?: string
  initialNotice?: 'password-saved'
  initialError?: 'google' | 'google-link'
}) {
  const landing = await getMemberLanding()
  if (landing) redirect(landing)
  const env = await getRequestEnv()
  return (
    <AuthCard
      locale={await getRequestLocale()}
      initialEmail={initialEmail}
      initialNotice={initialNotice}
      initialError={initialError}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
      tagline={pickTagline()}
    />
  )
}
