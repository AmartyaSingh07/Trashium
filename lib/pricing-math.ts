/**
 * Pure pricing math — safe to import from client OR server.
 * (lib/pricing.ts pulls in the server Supabase client, so it can't be imported by client code.)
 */

/** Apply a one-time payout boost (percent) to a household payout. Returns base unchanged when no boost. */
export function applyBoost(basePrice: number, pct: number | null | undefined): number {
  if (!pct) return basePrice;
  return +(basePrice * (1 + pct / 100)).toFixed(2);
}
