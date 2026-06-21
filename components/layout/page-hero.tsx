/**
 * Editorial hero used across the informational pages. Mirrors the landing
 * sections: Cormorant display heading, smoke subcopy, terra eyebrow label,
 * staggered fade-up entrance. Sits on the shared linen + grain + ribbons stack.
 */
export default function PageHero({
  eyebrow,
  title,
  highlight,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  subtitle: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-sand/20 bg-linen/40">
      {/* soft terra wash behind the type for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(194,112,61,0.18) 0%, rgba(194,112,61,0) 70%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 py-20 text-center lg:py-28">
        <p className="t-label animate-fade-up mb-4 text-terra">{eyebrow}</p>
        <h1 className="animate-fade-up-delay-1 font-[family-name:var(--font-cormorant)] text-4xl font-semibold leading-[1.05] text-bark sm:text-5xl lg:text-6xl">
          {title}{" "}
          {highlight && (
            <span className="text-gradient-terra font-semibold">{highlight}</span>
          )}
        </h1>
        <p className="animate-fade-up-delay-2 mx-auto mt-6 max-w-2xl font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
