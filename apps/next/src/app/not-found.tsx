import Link from 'next/link'
import { BrandShell } from '../client/shell'
import { pageMetadata } from '../server/metadata'
import { getRequestLocale } from '../server/locale'

export const generateMetadata = () => pageMetadata('Page not found', 'Страница не найдена')
export default async function NotFound() {
  const locale = await getRequestLocale()
  const ru = locale === 'ru'
  return (
    <BrandShell locale={locale}>
      <section className="public-state">
        <h1>{ru ? 'Страница не найдена' : 'Page not found'}</h1>
        <p>
          {ru
            ? 'Такой страницы нет, или она переехала. Проверьте адрес или вернитесь в Kuuki.'
            : 'This page does not exist or has moved. Check the address, or head back to Kuuki.'}
        </p>
        <p>
          <Link className="button primary" href="/">
            {ru ? 'В Kuuki' : 'Back to Kuuki'}
          </Link>
        </p>
      </section>
    </BrandShell>
  )
}
