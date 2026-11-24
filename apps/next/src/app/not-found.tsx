import { LocaleText } from '../client/locale-text'
import Link from 'next/link'
import { BrandShell } from '../client/brand-shell'
import { pageMetadata } from '../server/metadata'
import { getRequestLocale } from '../server/locale'
import '../client/ui/ui.css'

export const generateMetadata = () => pageMetadata('Page not found', 'Страница не найдена')
export default async function NotFound() {
  const locale = await getRequestLocale()
  return (
    <BrandShell locale={locale}>
      <section className="edge-card">
        <div className="edge-heading">
          <h1>
            <LocaleText locale={locale} en="Page not found" ru="Страница не найдена" />
          </h1>
          <p>
            <LocaleText
              locale={locale}
              en="This page does not exist or has moved. Check the address, or head back to Kuuki."
              ru="Такой страницы нет, или она переехала. Проверьте адрес или вернитесь в Kuuki."
            />
          </p>
        </div>
        <Link className="ui-button" data-variant="primary" href="/">
          <LocaleText locale={locale} en="Back to Kuuki" ru="В Kuuki" />
        </Link>
      </section>
    </BrandShell>
  )
}
