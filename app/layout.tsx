import type { Metadata } from 'next';
import {
  Cormorant_Garamond,
  Syne,
  DM_Sans,
  JetBrains_Mono,
} from 'next/font/google';
import Ribbons from '@/components/ui/Ribbons'; // Exact path from Phase 0, directly imported for SSR compatibility
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import SiteLoadGate from '@/components/ui/site-load-gate';

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
  // No weight array = variable font mode = all weights 100–900 available
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Trashium — Incentivized Waste Management',
  description:
    'AI-assisted recyclables aggregation platform for sustainable communities in West Bengal.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={[
        cormorant.variable,
        syne.variable,
        dmSans.variable,
        jetbrainsMono.variable,
      ].join(' ')}
    >
      <body className="bg-linen text-bark antialiased">

        {/* ─────────────────────────────────────────────
            LAYER 0 — WebGL Ribbons (full-screen, fixed)
            z-index: 0 | pointer-events: none
            Runs on ALL pages persistently.
            Opacity is controlled per-page via CSS var.
        ───────────────────────────────────────────── */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{ opacity: "var(--ribbon-opacity, 0.2)" } as React.CSSProperties}
          aria-hidden="true"
        >
          <Ribbons />
        </div>

        {/* ─────────────────────────────────────────────
            LAYER 1 — Grain texture (tactile paper effect)
            z-index: 2 | pointer-events: none
        ───────────────────────────────────────────── */}
        <div className="grain-overlay" aria-hidden="true" />

        {/* ─────────────────────────────────────────────
            LAYER 2 — All page content
            z-index: 10 | scrolls normally
        ───────────────────────────────────────────── */}
        <div className="relative z-10">
          {children}
        </div>

        {/* First-open splash — kinetic loader, once per session, fades after hydration */}
        <SiteLoadGate />

        <Toaster />
      </body>
    </html>
  );
}
