"use client";

import NumberFlow, { type Format } from "@number-flow/react";

export interface AnimatedNumberProps {
  /** The value to display. Transitions smoothly when it changes. */
  value: number;
  /** Intl.NumberFormat options (notation, maximumFractionDigits, style, etc.). */
  format?: Format;
  /** Text rendered before the number (e.g. "₹"). */
  prefix?: string;
  /** Text rendered after the number (e.g. "kg", "%"). */
  suffix?: string;
  /** Locale(s) for formatting. Defaults to the runtime locale. */
  locales?: Intl.LocalesArgument;
  className?: string;
}

/**
 * The consolidation target for numeric stats — a thin wrapper over
 * @number-flow/react. Covers CountUp's `{ value }` and AnimatedCounter's
 * `{ end, prefix, suffix, decimals }` APIs (decimals → format.maximumFractionDigits).
 * NumberFlow honors reduced-motion natively, so no extra guard is needed here.
 */
export function AnimatedNumber({
  value,
  format,
  prefix,
  suffix,
  locales,
  className,
}: AnimatedNumberProps) {
  return (
    <NumberFlow
      value={value}
      format={format}
      prefix={prefix}
      suffix={suffix}
      locales={locales}
      className={className}
    />
  );
}
