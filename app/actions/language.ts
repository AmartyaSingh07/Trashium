'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/request';

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist the chosen locale. Always writes the NEXT_LOCALE cookie (source of
 * truth for next-intl). If a user is signed in, also mirrors the choice into
 * profiles.preferred_language so it follows them across devices. Auth/RLS are
 * untouched — this only updates the caller's own row.
 */
export async function setLanguage(locale: string) {
  const safe: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as SupportedLocale)
    : 'en';

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', safe, {
    path: '/',
    maxAge: ONE_YEAR,
    sameSite: 'lax',
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ preferred_language: safe })
        .eq('id', user.id);
    }
  } catch {
    // Persisting to the profile is best-effort — the cookie already took effect,
    // so a DB hiccup must never block the language switch.
  }

  return { locale: safe };
}
