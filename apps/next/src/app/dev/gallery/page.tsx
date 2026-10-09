import { notFound } from 'next/navigation'
import { Gallery } from './gallery'

// Development-only fixture gallery for the shared primitives. Not linked from the app, no data fetching.
export const dynamic = 'force-dynamic'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; locale?: string }>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { theme, locale } = await searchParams
  return (
    <Gallery
      initialTheme={theme === 'dark' ? 'dark' : 'light'}
      initialLocale={locale === 'ru' ? 'ru' : 'en'}
    />
  )
}
