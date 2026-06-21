import type { Metadata } from "next";
import LegalPage, {
  P,
  UL,
  LI,
  Callout,
  type LegalSection,
} from "@/components/layout/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy — Trashium",
  description:
    "How Trashium uses cookies and browser storage. An honest, code-accurate account: auth session cookies, no advertising trackers.",
};

const sections: LegalSection[] = [
  {
    id: "what-are-cookies",
    heading: "What cookies & browser storage are",
    body: (
      <>
        <P>
          Cookies are small pieces of data a website asks your browser to keep.
          Alongside them, sites can use related browser storage — such as
          local storage and the cache — to remember things between visits. Both
          are stored on your own device and can be cleared at any time.
        </P>
        <Callout>
          Trashium is a student demonstration project. We use only what&apos;s
          needed to keep you logged in and make the app work — there are no
          advertising or cross-site tracking cookies.
        </Callout>
      </>
    ),
  },
  {
    id: "what-we-use",
    heading: "What Trashium actually uses",
    body: (
      <>
        <P>Based on how the app is built, here&apos;s what runs on your device:</P>
        <UL>
          <LI>
            <strong>Authentication cookies</strong> — login and session handling
            go through Supabase Auth, which stores secure session tokens (the{" "}
            <code className="rounded bg-parchment/80 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains)] text-xs text-clay">
              sb-…
            </code>{" "}
            cookies) so you stay signed in as you move between pages. These are
            essential — without them you couldn&apos;t log in.
          </LI>
          <LI>
            <strong>Service worker cache</strong> — Trashium is a Progressive Web
            App, so a service worker keeps a small cache of assets to help pages
            load. It does not store personal data.
          </LI>
          <LI>
            <strong>Preference state</strong> — some interface choices are kept
            in browser storage to remember your view between visits.
          </LI>
        </UL>
        <P>
          We do not run analytics, advertising, or third-party tracking cookies.
        </P>
      </>
    ),
  },
  {
    id: "third-party",
    heading: "Third-party services",
    body: (
      <P>
        Route and tracking maps are rendered with Leaflet using open map tiles,
        and fonts are loaded from Google Fonts. These services may receive basic
        technical requests (such as your IP address) needed to deliver tiles and
        fonts. Trashium itself does not place advertising or analytics trackers
        through them.
      </P>
    ),
  },
  {
    id: "managing",
    heading: "Managing cookies & storage",
    body: (
      <>
        <P>
          You&apos;re always in control of what stays on your device. In most
          browsers you can:
        </P>
        <UL>
          <LI>
            Open the site&apos;s settings (often the padlock icon in the address
            bar) to view and clear its cookies and storage.
          </LI>
          <LI>
            Use your browser&apos;s privacy or history settings to clear cookies
            and cached data site-by-site or all at once.
          </LI>
          <LI>Block or limit cookies through your browser&apos;s preferences.</LI>
        </UL>
        <P>
          Note that clearing or blocking the essential authentication cookies
          will sign you out and stop parts of the app from working.
        </P>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <P>
        If the project starts using new cookies or services, we&apos;ll update
        this page and the date at the top. For now, what&apos;s described here
        reflects the current build.
      </P>
    ),
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="June 2026"
      intro="A straight account of what Trashium keeps on your device — essential login cookies and a small app cache, with no advertising or tracking. Drawn directly from how the app is actually built."
      sections={sections}
    />
  );
}
