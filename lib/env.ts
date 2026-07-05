import { z } from "zod";

/**
 * Validated public environment variables.
 *
 * These are `NEXT_PUBLIC_*` and therefore safe to expose in the client bundle
 * (the anon key is public by design — it is RLS, not secrecy, that protects the
 * data). Validating them here fails fast with a clear message instead of the app
 * silently constructing a broken Supabase client from `undefined`.
 *
 * NOTE: Next.js statically inlines `NEXT_PUBLIC_*` only where they are referenced
 * as `process.env.NEXT_PUBLIC_X` literally — so they must be listed explicitly
 * below (not read dynamically) for the replacement to happen at build time.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
  }),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid or missing environment variables (see .env.example):\n${details}`
  );
}

export const env = parsed.data;
