"use client"

import * as React from "react"

interface CountUpProps {
  value: number
  /** Animation length in ms. */
  durationMs?: number
  className?: string
  /** Formats the in-flight number (default: rounded, locale-grouped). */
  format?: (n: number) => string
}

// ponytail: rAF tween, not a CSS keyframe — so it can count to an arbitrary value and stay
// screen-reader-correct (final value is real text, no aria-live spam). Honors reduced-motion itself
// because the global CSS reduced-motion rule only neutralizes CSS animations, not JS.
export function CountUp({ value, durationMs = 900, className, format }: CountUpProps) {
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString())
  const [display, setDisplay] = React.useState(value)
  const fromRef = React.useRef(value)

  React.useEffect(() => {
    const from = fromRef.current
    const to = value
    fromRef.current = value

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced || from === to) {
      setDisplay(to)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return <span className={className}>{fmt(display)}</span>
}
