import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// PII scrub shared by all three Sentry runtimes (client / server / edge).
// This app handles home addresses, emails, and pickup geo-coordinates —
// none of that may leave the building in an error report.

const PII_KEYS = [
  "email",
  "address",
  "full_name",
  "latitude",
  "longitude",
  "proof_latitude",
  "proof_longitude",
  "notes",
  "pincode",
] as const;

const PII_KEY_SET = new Set<string>(PII_KEYS);
const REDACTED = "[redacted]";

// Matches pii params embedded in URLs / query strings ("?email=a@b.c&latitude=22.6").
const PII_PARAM_RE = new RegExp(`([?&#;]|^)(${PII_KEYS.join("|")})=([^&#\\s]*)`, "gi");

// Free-text email addresses — the most likely + most identifying PII to leak into
// an error message or stack frame via string interpolation. Addresses/coords in
// free text can't be detected without false positives, so those keep relying on
// the key-based redaction in scrubDeep.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function scrubString(value: string): string {
  return value
    .replace(PII_PARAM_RE, `$1$2=${REDACTED}`)
    .replace(EMAIL_RE, REDACTED);
}

// Recursively redact PII keys and scrub query strings in any JSON-ish value.
function scrubDeep(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = PII_KEY_SET.has(key.toLowerCase()) ? REDACTED : scrubDeep(v);
    }
    return out;
  }
  return value;
}

/** `beforeSend` for all runtimes: strips user identity down to an opaque id and
 *  redacts PII keys anywhere in request / extra / contexts / breadcrumbs. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  if (event.request) {
    event.request = scrubDeep(event.request) as typeof event.request;
  }
  if (event.extra) {
    event.extra = scrubDeep(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  // The top-level message and exception values can embed PII via string
  // interpolation (e.g. `throw new Error(\`failed for ${email}\`)`).
  if (typeof event.message === "string") {
    event.message = scrubString(event.message);
  }
  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (typeof value.value === "string") value.value = scrubString(value.value);
    }
  }
  return event;
}

/** `beforeBreadcrumb` for all runtimes — Supabase/fetch breadcrumbs can carry
 *  query params with emails or coordinates. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return scrubDeep(breadcrumb) as Breadcrumb;
}
