import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

// Supported locales for Phase 1. The architecture is extensible — adding a new
// language is just (a) a new messages/<code>.json file and (b) appending the
// code here (and to the DB CHECK constraint / language-switcher map).
export const SUPPORTED_LOCALES = ['en', 'hi', 'bn'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Server-side locale resolver for next-intl in "without i18n routing" mode.
 * Locale is read from the NEXT_LOCALE cookie (written by the language switcher
 * and synced from profiles.preferred_language). Falls back to 'en'.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  const locale: SupportedLocale =
    cookieLocale && (SUPPORTED_LOCALES as readonly string[]).includes(cookieLocale)
      ? (cookieLocale as SupportedLocale)
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
