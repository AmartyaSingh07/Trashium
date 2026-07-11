import { AngledSlider } from "@/components/lightswind/angled-slider";

const SHOWCASE_ITEMS = [
  { id: 1, url: "/carousel/step-1.webp", title: "Step 1 — Schedule a pickup" },
  { id: 2, url: "/carousel/step-2.webp", title: "Step 2 — Crew collects your recyclables" },
  { id: 3, url: "/carousel/step-3.webp", title: "Step 3 — Waste is weighed and verified" },
  { id: 4, url: "/carousel/step-4.webp", title: "Step 4 — Earn Green Credits" },
  { id: 5, url: "/carousel/weight-banner.webp", title: "Fair, transparent weight-based payouts" },
];

/**
 * Infinite angled showcase carousel — sits directly below the hero trust bar.
 * Server component; the slider itself is a client component (CSS-only motion).
 */
export default function ShowcaseCarousel() {
  return (
    <section className="relative z-10 -mt-10 sm:-mt-14" aria-label="Product showcase">
      <AngledSlider items={SHOWCASE_ITEMS} speed={45} />
    </section>
  );
}
