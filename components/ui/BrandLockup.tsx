// Trashium primary lockup (icon + wordmark).
// animated → <object> so the SVG's embedded CSS keyframes run (an <img> freezes them).
// static   → plain <img>. Reduced-motion is handled inside the animated SVG itself.
interface Props {
  variant?: "static" | "animated";
  className?: string;
}

// The primary lockup SVG is 260×180 (≈1.444:1). <object> does NOT derive its
// box from the SVG's intrinsic ratio the way <img> does, so we pin the ratio
// here — that lets height-driven utilities (e.g. `h-28 w-auto`) produce the
// correct width without squishing the artwork.
const LOCKUP_ASPECT = "260 / 180";

export default function BrandLockup({ variant = "static", className }: Props) {
  if (variant === "animated") {
    return (
      <object
        type="image/svg+xml"
        data="/brand/trashium-primary-animated.svg"
        aria-label="Trashium"
        className={className}
        style={{ aspectRatio: LOCKUP_ASPECT, pointerEvents: "none" }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/trashium-primary-static.svg" alt="Trashium" className={className} />;
}
