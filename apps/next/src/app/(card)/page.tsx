import { CardPage, cardMetadata } from './card-page'

export const generateMetadata = () => cardMetadata({ canonical: false })
// The legacy `?mode=signin` / `?mode=signup` links land here too and are ignored.
export default function Home() {
  return <CardPage />
}
