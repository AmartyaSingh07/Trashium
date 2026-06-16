-- ============================================================================
-- 0002_pricing_ml.sql  —  ML pricing + profitability layer for Trashium
-- Adds the columns/tables the pricing engine needs. Additive & idempotent.
-- Apply BEFORE seeding (0003) and before running publish_to_supabase.py.
-- NOTE: price_estimates.area now stores an OPERATIONAL SECTOR
--       (Rishra | Howrah | Shyamnagar | Tarakeswar | Hugli-Chinsura),
--       matching the pickup form, not the old Urban/Suburban/Rural tiers.
-- ============================================================================

-- 1) Extend price_estimates with the profit layer ---------------------------
ALTER TABLE public.price_estimates
  ADD COLUMN IF NOT EXISTS logistics_per_kg     NUMERIC,
  ADD COLUMN IF NOT EXISTS market_price_per_kg  NUMERIC,
  ADD COLUMN IF NOT EXISTS profit_per_kg        NUMERIC,
  ADD COLUMN IF NOT EXISTS model_version        TEXT;

-- 2) Store the quote + economics on each pickup -----------------------------
ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS logistics_cost  NUMERIC,
  ADD COLUMN IF NOT EXISTS profit_margin   NUMERIC;
-- (estimated_price already exists in the base schema.)

-- 3) External recycler selling price (the real MarketPrice feed) -------------
CREATE TABLE IF NOT EXISTS public.market_prices (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  waste_type          TEXT NOT NULL,
  area                TEXT NOT NULL,
  market_price_per_kg NUMERIC NOT NULL,
  effective_date      DATE NOT NULL DEFAULT current_date,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (waste_type, area, effective_date)
);
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read market prices"
  ON public.market_prices FOR SELECT USING (true);
CREATE POLICY "Only admins can modify market prices"
  ON public.market_prices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4) Moving-average trend table (guardrail / cold-start / drift) -------------
CREATE TABLE IF NOT EXISTS public.ma_trends (
  sector      TEXT NOT NULL,
  waste_type  TEXT NOT NULL,
  sma_7  NUMERIC, sma_15 NUMERIC, sma_30 NUMERIC, sma_90 NUMERIC,
  vol_30 NUMERIC,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sector, waste_type)
);
ALTER TABLE public.ma_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ma_trends"
  ON public.ma_trends FOR SELECT USING (true);
CREATE POLICY "Only admins can modify ma_trends"
  ON public.ma_trends FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5) Model quality tracking (for monitoring + viva) -------------------------
CREATE TABLE IF NOT EXISTS public.model_metrics (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model_version TEXT NOT NULL,
  mae  NUMERIC, rmse NUMERIC, r2 NUMERIC,
  trained_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.model_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read model metrics"
  ON public.model_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
