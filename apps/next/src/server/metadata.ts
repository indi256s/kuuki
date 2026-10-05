import 'server-only'
import type { Metadata } from 'next'
import { getRequestLocale } from './locale'

/** Localized "<Page> · Kuuki" title for generateMetadata. */
export async function pageMetadata(en: string, ru: string, extra: Metadata = {}): Promise<Metadata> {
  return { ...extra, title: `${(await getRequestLocale()) === 'ru' ? ru : en} · Kuuki` }
}
