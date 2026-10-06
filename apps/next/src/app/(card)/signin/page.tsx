import { CardPage, cardMetadata } from '../card-page'

export const generateMetadata = () => cardMetadata({ canonical: true })
export default async function SignIn({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams
  return <CardPage initialEmail={typeof email === 'string' ? email : ''} />
}
