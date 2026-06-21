import type { Metadata, Viewport } from 'next';
import {
  Cormorant_Garamond,
  Syne,
  DM_Sans,
  JetBrains_Mono,
  Noto_Sans_Devanagari,
  Hind_Siliguri,
} from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import Ribbons from '@/components/ui/Ribbons'; // Exact path from Phase 0, directly imported for SSR compatibility
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import SiteLoadGate from '@/components/ui/site-load-gate';
import ServiceWorkerRegister from '@/components/ui/sw-register';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['400', '500', '600'],
  display: 'swap',
});
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['600', '700', '800'],
  display: 'swap',
});
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  // No weight array = variable font mode = all weights 100-900 available
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500'],
  display: 'swap',
});
// Indic-script coverage so Hindi (Devanagari) and Bengali render real glyphs
// instead of tofu boxes. Wired as CSS-var fallbacks in globals.css.
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali'],
  variable: '--font-bengali',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Trashium - Incentivized Waste Management',
  description:
    'AI-assisted recyclables aggregation platform for sustainable communities in West Bengal.',
  applicationName: 'Trashium',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trashium',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#2A2218',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Locale + messages come from i18n/request.ts (reads the NEXT_LOCALE cookie).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={[
        cormorant.variable,
        syne.variable,
        dmSans.variable,
        jetbrainsMono.variable,
        notoDevanagari.variable,
        hindSiliguri.variable,
      ].join(' ')}
    >
      <body className="bg-linen text-bark antialiased">
        {/* next-intl provider — required so client components (useTranslations) work
            in "without i18n routing" mode. Wraps everything below. */}
        <NextIntlClientProvider locale={locale} messages={messages}>

          {/* LAYER 0 - WebGL Ribbons (full-screen, fixed). z-index: 0, pointer-events: none. */}
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            style={{ opacity: "var(--ribbon-opacity, 0.2)" } as React.CSSProperties}
            aria-hidden="true"
          >
            <Ribbons />
          </div>

          {/* LAYER 1 - Grain texture (tactile paper effect). z-index: 2, pointer-events: none. */}
          <div className="grain-overlay" aria-hidden="true" />

          {/* LAYER 2 - All page content. z-index: 10, scrolls normally. */}
          <div className="relative z-10">
            {children}
          </div>

          {/* First-open splash - kinetic loader, once per session, fades after hydration */}
          <SiteLoadGate />

          {/* PWA: register the service worker (renders nothing) */}
          <ServiceWorkerRegister />

          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
