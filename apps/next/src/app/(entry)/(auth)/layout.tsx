import type { ReactNode } from 'react'
import { AuthBrand } from '../../../client/public/auth-shell'
import { getRequestLocale } from '../../../server/locale'

/** Password recovery and activation requests, until they move into the auth card's request state. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale()
  return <div className="auth-shell"><AuthBrand locale={locale} /><section className="auth-shell-panel">{children}</section></div>
}
