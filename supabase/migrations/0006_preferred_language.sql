-- Migration 0006: Add preferred_language to profiles (i18n Phase 1)
-- Applied live to project fqbjjcbrxrokvdwkydze on 2026-06-21 via MCP.
-- Stores the user's chosen UI language so it follows them across devices.
-- The NEXT_LOCALE cookie remains the request-time source of truth for next-intl;
-- this column is the durable, per-user mirror written by app/actions/language.ts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT
  DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'pa'));

-- Index for analytics / language-distribution queries (optional)
CREATE INDEX IF NOT EXISTS idx_profiles_lang ON public.profiles(preferred_language);

COMMENT ON COLUMN public.profiles.preferred_language IS
  'BCP-47 language code. Default: en. Phase 1 supported: en, hi, bn (extendable to all Indian regional languages)';

-- RLS note: no policy change needed. The existing "Users can update own profile"
-- policy already covers writes to this column (a user updating their own row).
