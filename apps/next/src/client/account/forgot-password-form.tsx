'use client'

import { EmailLinkForm } from '../public/email-link-form'

export function ForgotPasswordForm({ locale }: { locale: 'en' | 'ru' }) {
  return <EmailLinkForm locale={locale} purpose="recovery" />
}
