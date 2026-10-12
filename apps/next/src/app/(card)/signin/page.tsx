import { CardPage, cardMetadata } from '../card-page'

export const generateMetadata = () => cardMetadata({ canonical: true })
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; notice?: string; error?: string }>
}) {
  const { email, notice, error } = await searchParams
  return (
    <CardPage
      initialEmail={typeof email === 'string' ? email : ''}
      initialNotice={notice === 'password-saved' ? notice : undefined}
      initialError={error ? (error === 'account_not_linked' ? 'google-link' : 'google') : undefined}
    />
  )
}
