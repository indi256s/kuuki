import { CardPage, cardMetadata } from '../card-page'

export const generateMetadata = () => cardMetadata({ canonical: true })
export default function SignUp() {
  return <CardPage />
}
