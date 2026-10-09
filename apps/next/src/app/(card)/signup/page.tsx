import { CardPage, cardMetadata } from '../card-page'

export const generateMetadata = () => cardMetadata({ canonical: true })
export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const { notice } = await searchParams
  return <CardPage initialNotice={notice === 'password-saved' ? notice : undefined} />
}
