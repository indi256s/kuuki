import type { ReactNode } from 'react'
import { AuthBrand } from '../../../client/public/auth-shell'
import { RouteStage } from '../../../client/route-transitions'
import { getRequestLocale } from '../../../server/locale'

/** The card and brand panel stay put across sign in, sign up, password recovery and activation; only the form panel swaps. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale()
  return <div className="auth-shell"><AuthBrand locale={locale} /><RouteStage stage="auth" className="auth-shell-panel">{children}</RouteStage></div>
}
