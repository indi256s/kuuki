import { CardPage, cardMetadata } from './card-page'

export const generateMetadata = () => cardMetadata({ canonical: false })
// The legacy `?mode=signin` / `?mode=signup` links land here too and are ignored.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const { notice } = await searchParams
  return <CardPage initialNotice={notice === 'password-saved' ? notice : undefined} />
}
