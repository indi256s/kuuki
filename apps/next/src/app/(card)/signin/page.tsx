import { CardPage, cardMetadata } from '../card-page'

export const generateMetadata = () => cardMetadata({ canonical: true })
export default async function SignIn({ searchParams }: { searchParams: Promise<{ email?: string; notice?: string }> }) {
  const { email, notice } = await searchParams
  return <CardPage initialEmail={typeof email === 'string' ? email : ''} initialNotice={notice === 'password-saved' ? notice : undefined} />
}
