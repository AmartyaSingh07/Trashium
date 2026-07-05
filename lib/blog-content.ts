// Static copy + asset manifest for the /blog interactive showcase.
// In-repo by decision (no Supabase, no CMS). English-only for now —
// phase-2 revisits a `blog` i18n namespace (spec §9).

export interface FeatureBeat {
  title: string;
  body: string;
}

export interface BlogScreenshot {
  src: string;
  alt: string;
  caption: string;
}

export interface BlogStat {
  value: number;
  label: string;
}

export const BLOG_HERO = {
  eyebrow: "Product showcase",
  title: "Watch waste become worth",
  subtitle:
    "One scrolling story of how Trashium works — the household app, the crew hub, and the admin console, exactly as they run across West Bengal today.",
} as const;

export const PHONE_MEDIA = {
  webm: "/blog/phone/walkthrough.webm",
  mp4: "/blog/phone/walkthrough.mp4",
  poster: "/blog/phone/poster.jpg",
} as const;

export const PHONE_SECTION = {
  eyebrow: "How it works",
  title: "A guided walk through the app",
} as const;

export const FEATURE_BEATS: FeatureBeat[] = [
  {
    title: "Schedule in seconds",
    body: "Pick a waste type, a sector, and a weight — the household app quotes a fair payout before you confirm a pickup.",
  },
  {
    title: "Priced by models, not haggling",
    body: "Rates come from a nightly ML pipeline trained on real scrap-market data, published per material and per sector.",
  },
  {
    title: "Earn while you sort",
    body: "Completed pickups mint Green Credits that climb twenty eco-levels, unlock badges, and open the rewards marketplace.",
  },
  {
    title: "Proof at the doorstep",
    body: "Crews follow an optimized route and file a geo-tagged photo proof for every collection, verified in the admin console.",
  },
];

export const GALLERY_SECTION = {
  eyebrow: "See it live",
  title: "Straight from the product",
} as const;

export const SCREENSHOTS: BlogScreenshot[] = [
  {
    src: "/blog/shots/landing-hero.webp",
    alt: "Trashium landing page hero",
    caption: "The landing experience",
  },
  {
    src: "/blog/shots/household-dashboard.webp",
    alt: "Household dashboard with eco-level progress and pickups",
    caption: "Household dashboard + eco-levels",
  },
  {
    src: "/blog/shots/marketplace.webp",
    alt: "Rewards marketplace with redeemable items",
    caption: "Rewards marketplace",
  },
  {
    src: "/blog/shots/crew-route-map.webp",
    alt: "Crew hub showing the optimized collection route on a map",
    caption: "Crew hub — optimized route",
  },
  {
    src: "/blog/shots/crew-geo-proof.webp",
    alt: "Crew hub geo-tagged pickup proof modal",
    caption: "Crew hub — geo-tagged pickup proof",
  },
  {
    src: "/blog/shots/admin-panel.webp",
    alt: "Admin operations console with platform analytics",
    caption: "Admin operations console",
  },
];

export const STATS_SECTION = {
  eyebrow: "At a glance",
  title: "The platform in numbers",
} as const;

export const STATS: BlogStat[] = [
  { value: 5, label: "Operational sectors" },
  { value: 7, label: "Materials priced nightly" },
  { value: 20, label: "Eco-levels to climb" },
  { value: 15, label: "Badges to earn" },
];

export const CTA = {
  title: "Ready to turn your waste into worth?",
  body: "Schedule your first pickup, earn Green Credits, and watch your eco-level grow — Trashium is live across five West Bengal sectors.",
  primary: { label: "Create your account", href: "/signup" },
  secondary: { label: "Read our story", href: "/about" },
} as const;
