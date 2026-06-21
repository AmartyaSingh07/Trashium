-- Enable the uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'household', -- 'household', 'collector', 'admin'
  eco_level TEXT NOT NULL DEFAULT 'Seedling',
  green_credits NUMERIC NOT NULL DEFAULT 0,
  kg_recycled NUMERIC NOT NULL DEFAULT 0,
  co2_saved NUMERIC NOT NULL DEFAULT 0,
  pickups_completed INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  operating_zone TEXT, -- crew/collector home sector (one of OPERATIONAL_SECTORS); NULL for households/admin
  preferred_language TEXT DEFAULT 'en'
    CHECK (preferred_language IN ('en','hi','bn','ta','te','mr','gu','kn','ml','or','pa')), -- i18n UI language (migration 0006)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Index for language-distribution analytics (migration 0006)
CREATE INDEX IF NOT EXISTS idx_profiles_lang ON public.profiles(preferred_language);

-- RLS Policies for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Admins and collectors can view all profiles
CREATE POLICY "Admins and collectors can view all profiles" 
ON public.profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'collector')
  )
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- ==========================================
-- 2. PICKUP REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pickup_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  waste_type TEXT NOT NULL,                         -- dominant pricing bucket (a valid WasteType)
  waste_items TEXT[],                               -- granular leaf types the household selected (multi-select)
  estimated_weight NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'collected', 'processed', 'cancelled'
  scheduled_date DATE NOT NULL,
  notes TEXT,
  estimated_price NUMERIC,
  latitude  NUMERIC, -- pickup geocoordinates (route optimization); nullable
  longitude NUMERIC,
  payout_override NUMERIC,                          -- admin-set final payout (INR); NULL = use estimated_price
  override_by UUID REFERENCES public.profiles(id),  -- who overrode (audit)
  override_at TIMESTAMP WITH TIME ZONE,             -- when (audit)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Authoritative payout for a pickup = COALESCE(payout_override, estimated_price).
-- TODO(override-ledger): add a payout_overrides history table if a fuller audit trail is needed.

-- RLS Policies for Pickup Requests
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own pickup requests
CREATE POLICY "Users can view own pickup requests" 
ON public.pickup_requests FOR SELECT 
USING (auth.uid() = user_id);

-- Admins and collectors can view all pickup requests
CREATE POLICY "Admins and collectors can view all pickups" 
ON public.pickup_requests FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'collector')
  )
);

-- Users can insert their own pickup requests
CREATE POLICY "Users can insert own pickup requests" 
ON public.pickup_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pickup requests (e.g., to cancel)
CREATE POLICY "Users can update own pickup requests" 
ON public.pickup_requests FOR UPDATE 
USING (auth.uid() = user_id);

-- Admins and collectors can update all pickup requests
CREATE POLICY "Admins and collectors can update pickups" 
ON public.pickup_requests FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'collector')
  )
);

-- ==========================================
-- 3. GLOBAL IMPACT TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.global_impact (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_kg_recycled NUMERIC NOT NULL DEFAULT 0,
  total_co2_saved NUMERIC NOT NULL DEFAULT 0,
  total_households INTEGER NOT NULL DEFAULT 0,
  total_green_credits NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for Global Impact
ALTER TABLE public.global_impact ENABLE ROW LEVEL SECURITY;

-- Anyone can read global impact
CREATE POLICY "Anyone can read global impact" 
ON public.global_impact FOR SELECT 
USING (true);

-- Only admins can update global impact (or triggers)
CREATE POLICY "Only admins can update global impact" 
ON public.global_impact FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ==========================================
-- 4. PRICE ESTIMATES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.price_estimates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  waste_type TEXT NOT NULL,
  area TEXT NOT NULL,
  price_per_kg NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(waste_type, area)
);

-- RLS Policies for Price Estimates
ALTER TABLE public.price_estimates ENABLE ROW LEVEL SECURITY;

-- Anyone can read price estimates
CREATE POLICY "Anyone can read price estimates" 
ON public.price_estimates FOR SELECT 
USING (true);

-- Only admins can update price estimates
CREATE POLICY "Only admins can modify price estimates" 
ON public.price_estimates FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ==========================================
-- 5. TRIGGERS & FUNCTIONS
-- ==========================================

-- Function to handle auto-creating a profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email
  );
  RETURN new;
END;
$$;

-- Trigger to call the profile creation function on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 6. INITIAL SEED DATA
-- ==========================================
INSERT INTO public.global_impact (id, total_kg_recycled, total_co2_saved, total_households, total_green_credits)
VALUES (1, 12450.5, 8930.2, 342, 28750.0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.price_estimates (waste_type, area, price_per_kg) VALUES
('Plastic', 'Urban', 15.00),
('Plastic', 'Suburban', 12.00),
('Plastic', 'Rural', 10.00),
('Paper', 'Urban', 8.00),
('Paper', 'Suburban', 7.00),
('Paper', 'Rural', 5.00),
('Glass', 'Urban', 5.00),
('Glass', 'Suburban', 4.00),
('Glass', 'Rural', 3.00),
('Metal', 'Urban', 25.00),
('Metal', 'Suburban', 22.00),
('Metal', 'Rural', 20.00),
('E-Waste', 'Urban', 50.00),
('E-Waste', 'Suburban', 45.00),
('E-Waste', 'Rural', 40.00),
('Organic', 'Urban', 2.00),
('Organic', 'Suburban', 1.50),
('Organic', 'Rural', 1.00),
('Mixed', 'Urban', 4.00),
('Mixed', 'Suburban', 3.00),
('Mixed', 'Rural', 2.00),
-- TODO(ml-battery): batteries seeded from E-Waste rates as a placeholder; train real battery rates in /ml.
('Battery', 'Urban', 50.00),
('Battery', 'Suburban', 45.00),
('Battery', 'Rural', 40.00)
ON CONFLICT (waste_type, area) DO NOTHING;

-- ==========================================
-- 7. GAMIFICATION & MARKETPLACE (Badges + Marketplace + Payout Booster)
-- RLS intentionally NOT enabled yet — see the commented TODO(RLS, later) block at the end.
-- ==========================================

-- Module F: single pending payout boost (percent) applied to the user's next pickup payout.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pending_payout_boost_pct NUMERIC;

-- 7a. BADGES (catalog of all 15)
CREATE TABLE IF NOT EXISTS public.badges (
  id               TEXT PRIMARY KEY,            -- 'b1'..'b15'
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  image_filename   TEXT,                        -- nullable; user supplies art later
  category         TEXT NOT NULL,               -- 'milestone' | 'streak' | 'material' | 'social' | 'special'
  unlock_type      TEXT NOT NULL,               -- 'credits' | 'pickups' | 'kg' | 'categories' | 'streak' | 'referral' | 'quiz' | 'manual'
  unlock_threshold NUMERIC,                      -- nullable; meaning depends on unlock_type
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7b. USER_BADGES (manual/campaign grants only — computed badges are derived live)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

INSERT INTO public.badges (id, title, description, category, unlock_type, unlock_threshold, sort_order, image_filename) VALUES
  ('b1',  'Trash-to-Treasure',    'Completed your first Trashium pickup.',                     'milestone', 'pickups',    1,    1,  'trash_2_treasure.png'),
  ('b2',  'Sprouting Value',      'Established the foundation of your rewards journey.',        'milestone', 'credits',    250,  2,  'sprouting_value.png'),
  ('b3',  'Eco Rookie',           'Maintained your recycling habit for 7 consecutive days.',   'streak',    'streak',     7,    3,  'eco_rookie.png'),
  ('b4',  'Green Momentum',       'Stayed committed to sustainable actions for 30 days.',      'milestone', 'credits',    1500, 4,  'green_momentum.png'),
  ('b5',  'Unstoppable Recycler', 'Achieved a 100-day eco streak.',                            'streak',    'streak',     100,  5,  'unstoppable_recycler.png'),
  ('b6',  'Waste Warrior',        'Demonstrated year-round dedication with a 250-day streak.', 'streak',    'streak',     250,  6,  'waste_warrior.png'),
  ('b7',  'Paper Protector',      'Recycled 50 kg of paper.',                                  'material',  'kg',         50,   7,  'paper_protector.png'),
  ('b8',  'Plastic Patrol',       'Successfully recycled 30 kg of plastic.',                   'material',  'kg',         30,   8,  'plastic_patrol.png'),
  ('b9',  'Metal Maverick',       'Recycled 100 kg of metal.',                                 'material',  'kg',         100,  9,  'metal_maverick.png'),
  ('b10', 'Eco Influencer',       'Inspired 5 friends to join.',                               'social',    'referral',   5,    10, 'eco_influencer.png'),
  ('b11', 'Eco Brainiac',         'Completed 100 sustainability quizzes.',                     'special',   'quiz',       100,  11, 'eco_brainiac.png'),
  ('b12', 'Circular Citizen',     'Recycled across every available waste category.',           'material',  'categories', 7,    12, 'circular_citizen.png'),
  ('b13', 'Trashium Veteran',     'Stayed active on Trashium for one full year.',              'special',   'manual',     NULL, 13, 'trashium_veteran.png'),
  ('b14', 'Forest Elder',         'Reach Level 19 — 2,500 lifetime Green Credits.',            'milestone', 'credits',    2500, 14, 'forest_elder.png'),
  ('b15', 'Planet Partner',       'Participated in a special sustainability campaign.',        'special',   'manual',     NULL, 15, 'planet_partner.png')
ON CONFLICT (id) DO NOTHING;

-- 7c. MARKETPLACE_ITEMS (redeemable catalog)
CREATE TABLE IF NOT EXISTS public.marketplace_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  tier              TEXT NOT NULL,        -- 'seedling' | 'sapling' | 'forest' | 'perk' | 'legendary'
  cost_credits      INT NOT NULL CHECK (cost_credits >= 0),
  image_filename    TEXT,                 -- nullable; art supplied later
  level_requirement INT,                  -- nullable; min eco-level number (1..20)
  badge_requirement TEXT REFERENCES public.badges(id),  -- nullable; required badge id
  stock             INT,                  -- nullable = unlimited
  is_active         BOOLEAN NOT NULL DEFAULT true,
  perk_type         TEXT,                 -- nullable; 'payout_boost' for the Payout Booster perk
  perk_value        NUMERIC,              -- nullable; e.g. boost percent
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7d. REDEMPTION_ORDERS (demo-fulfilled by admin: pending -> dispatched -> delivered / cancelled)
CREATE TABLE IF NOT EXISTS public.redemption_orders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id            UUID NOT NULL REFERENCES public.marketplace_items(id),
  item_name          TEXT NOT NULL,        -- snapshot for history
  cost_at_redemption INT NOT NULL,         -- snapshot
  status             TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'dispatched'|'delivered'|'cancelled'
  shipping_note      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time catalog seed (guarded so re-running this file doesn't duplicate rows). image_filename = NULL.
INSERT INTO public.marketplace_items
  (name, description, tier, cost_credits, badge_requirement, perk_type, perk_value, sort_order)
SELECT * FROM (VALUES
  ('Sticker Pack',               'A set of Trashium eco-themed vinyl stickers.',                       'seedling',  500,  NULL::text,  NULL::text,          NULL::numeric, 1),
  ('Eco Bookmark',               'Recycled-paper bookmark with botanical art.',                        'seedling',  600,  NULL, NULL, NULL, 2),
  ('Seed Paper Card',            'Plantable greeting card embedded with wildflower seeds.',            'seedling',  750,  NULL, NULL, NULL, 3),
  ('Eco Pouch',                  'Small zip pouch made from recycled fabric.',                         'seedling',  1000, NULL, NULL, NULL, 4),
  ('Eco Cap',                    'Organic-cotton cap. Variants: Olive / Sand (choose at fulfilment).', 'sapling',   1800, NULL, NULL, NULL, 5),
  ('Tote Bag',                   'Reusable recycled-canvas tote with the Trashium mark.',              'sapling',   2000, NULL, NULL, NULL, 6),
  ('Ceramic Mug',                'Stoneware mug, 350ml.',                                              'sapling',   2500, NULL, NULL, NULL, 7),
  ('Recycled Notebook',          'A5 notebook, recycled pages.',                                       'sapling',   3000, NULL, NULL, NULL, 8),
  ('Organic Tee',                'Organic-cotton t-shirt. Sizes S-XXL (choose at fulfilment).',        'forest',    5000, NULL,  NULL, NULL, 9),
  ('Forest Elder Tee',           'Limited Forest Elder edition tee. Requires the Forest Elder badge.', 'forest',    7000, 'b14', NULL, NULL, 10),
  ('Hoodie',                     'Heavyweight recycled-blend hoodie. Sizes S-XXL.',                    'forest',    9000, NULL,  NULL, NULL, 11),
  ('Forest Elder Collector Mug', 'Collector mug for Forest Elders. Requires the Forest Elder badge.',  'legendary', 5000, 'b14', NULL, NULL, 12),
  ('Planet Partner Kit',         'Exclusive kit for Planet Partners. Requires the Planet Partner badge.','legendary',7000, 'b15', NULL, NULL, 13),
  ('Payout Booster',             'Adds +10% to your next pickup payout. One-time use.',                'perk',      300,  NULL, 'payout_boost', 10, 14)
) AS v(name, description, tier, cost_credits, badge_requirement, perk_type, perk_value, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.marketplace_items);

-- 7e. ATOMIC REDEMPTION RPC
-- Deducts credits, decrements stock, writes an order, and sets a pending payout boost — all in one
-- transaction. RLS is off for now, so the function validates everything itself.
CREATE OR REPLACE FUNCTION public.redeem_marketplace_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_item    public.marketplace_items%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_badge   public.badges%ROWTYPE;
  v_has_badge boolean;
  v_required_min int;
  -- minPoints for levels 1..20 (mirrors TRASHIUM_EVALUATION_TIERS in lib/gamification.ts)
  v_tier_min int[] := ARRAY[0,15,40,75,120,180,250,330,420,520,640,780,940,1120,1320,1550,1820,2130,2500,3000];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_item FROM public.marketplace_items WHERE id = p_item_id;
  IF NOT FOUND OR v_item.is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'inactive');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF v_item.stock IS NOT NULL AND v_item.stock <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'out_of_stock');
  END IF;

  IF v_item.level_requirement IS NOT NULL THEN
    v_required_min := v_tier_min[v_item.level_requirement];
    IF v_required_min IS NULL OR v_profile.green_credits < v_required_min THEN
      RETURN jsonb_build_object('success', false, 'error', 'locked_level');
    END IF;
  END IF;

  IF v_item.badge_requirement IS NOT NULL THEN
    SELECT * INTO v_badge FROM public.badges WHERE id = v_item.badge_requirement;
    IF v_badge.unlock_type = 'credits' THEN
      v_has_badge := v_profile.green_credits >= COALESCE(v_badge.unlock_threshold, 999999999);
    ELSIF v_badge.unlock_type = 'pickups' THEN
      v_has_badge := v_profile.pickups_completed >= COALESCE(v_badge.unlock_threshold, 999999999);
    ELSE
      v_has_badge := EXISTS (
        SELECT 1 FROM public.user_badges ub
        WHERE ub.user_id = v_uid AND ub.badge_id = v_item.badge_requirement
      );
    END IF;
    IF NOT v_has_badge THEN
      RETURN jsonb_build_object('success', false, 'error', 'locked_badge');
    END IF;
  END IF;

  IF v_profile.green_credits < v_item.cost_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  -- TODO(dual-balance): deduct from a spendable wallet, not the lifetime score that drives
  -- eco-levels/badges. Spending below a gate can re-lock access — accepted tradeoff (D1).
  UPDATE public.profiles
     SET green_credits = green_credits - v_item.cost_credits,
         pending_payout_boost_pct = CASE WHEN v_item.perk_type = 'payout_boost'
                                         THEN v_item.perk_value ELSE pending_payout_boost_pct END,
         updated_at = now()
   WHERE id = v_uid;

  IF v_item.stock IS NOT NULL THEN
    UPDATE public.marketplace_items SET stock = stock - 1 WHERE id = p_item_id;
  END IF;

  INSERT INTO public.redemption_orders (user_id, item_id, item_name, cost_at_redemption, status)
  VALUES (v_uid, p_item_id, v_item.name, v_item.cost_credits, 'pending');

  RETURN jsonb_build_object('success', true, 'new_balance', v_profile.green_credits - v_item.cost_credits);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_marketplace_item(uuid) TO authenticated;

-- 7f. HOUSEHOLDS-ONLY LEADERBOARD (read-only projection)
-- SECURITY DEFINER bypasses RLS for a limited-column, no-email read. Admin/crew are excluded by the
-- role filter. Sector = most frequent completed-pickup location; null when the household has none.
CREATE OR REPLACE FUNCTION public.get_household_leaderboard()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  sector text,
  green_credits numeric,
  kg_recycled numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE(p.full_name, 'Eco Warrior') AS display_name,
    mode() WITHIN GROUP (ORDER BY pr.location) AS sector,   -- most frequent pickup sector
    p.green_credits,
    p.kg_recycled
  FROM profiles p
  LEFT JOIN pickup_requests pr
    ON pr.user_id = p.id
   AND pr.status IN ('collected','processed','completed')
  WHERE p.role = 'household'
  GROUP BY p.id, p.full_name, p.green_credits, p.kg_recycled;
$$;

GRANT EXECUTE ON FUNCTION public.get_household_leaderboard() TO anon, authenticated;

-- ==========================================
-- 8. DAILY GROVE RITUAL — authoritative daily-action + streak engine
-- Daily-action credits move ONLY through log_daily_action() (SECURITY DEFINER, auth.uid()).
-- Caps/streaks/chests are server-tracked, not client. RLS disabled for now (TODO(RLS)).
-- ==========================================

-- 8a. One row per user per day.
CREATE TABLE IF NOT EXISTS public.daily_activity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date date NOT NULL DEFAULT current_date,
  logged_in boolean NOT NULL DEFAULT false,
  segregated boolean NOT NULL DEFAULT false,
  quizzes_correct int NOT NULL DEFAULT 0,
  quiz_strikes int NOT NULL DEFAULT 0,
  perfect_day boolean NOT NULL DEFAULT false,
  credits_earned numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, activity_date)
);
ALTER TABLE public.daily_activity DISABLE ROW LEVEL SECURITY;

-- 8b. Additive streak columns on profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date date,
  ADD COLUMN IF NOT EXISTS streak_freezes int NOT NULL DEFAULT 1;  -- everyone starts with 1 shield

-- 8c. Milestone chest claim ledger (each chest claimed once).
CREATE TABLE IF NOT EXISTS public.streak_milestone_claims (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone int NOT NULL,                 -- 3 / 7 / 14 / 30
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone)
);
ALTER TABLE public.streak_milestone_claims DISABLE ROW LEVEL SECURITY;

-- 8d. log_daily_action — single source of truth for daily-action credits.
-- Actions: login(+1) / segregate(+2) / quiz_correct(+1, ≤5/day) / quiz_strike(0, ≤2/day).
-- Streak advances once/day (first earning action); shield covers exactly one missed day.
-- Multiplier = least(2.0, 1 + 0.05*streak). Perfect Day = login+segregate+quiz (capstone round(5*mult)).
-- Milestone chests at 3/7/14/30 (claim-once): +10 / +20 & shield / +40 / +100 & shield.
CREATE OR REPLACE FUNCTION public.log_daily_action(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_today  date := current_date;
  v_row    public.daily_activity%ROWTYPE;
  v_prof   public.profiles%ROWTYPE;
  v_logged boolean; v_segr boolean; v_qc int; v_qs int; v_perfect boolean;
  v_base int := 0; v_mult numeric := 1.0; v_award numeric := 0; v_total numeric := 0;
  v_perfect_fired boolean := false;
  v_freeze_used boolean := false;
  v_chest jsonb := null; v_chest_reward int := 0; v_chest_freeze int := 0;
  v_streak int; v_longest int; v_freezes int;
  v_weekly int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF p_action NOT IN ('login','segregate','quiz_correct','quiz_strike') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_action');
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;

  INSERT INTO public.daily_activity (user_id, activity_date) VALUES (v_uid, v_today)
  ON CONFLICT (user_id, activity_date) DO NOTHING;
  SELECT * INTO v_row FROM public.daily_activity WHERE user_id = v_uid AND activity_date = v_today FOR UPDATE;

  IF p_action = 'segregate' AND v_row.segregated THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_segregated');
  ELSIF p_action = 'quiz_correct' AND v_row.quizzes_correct >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quiz_cap');
  ELSIF p_action = 'quiz_strike' AND v_row.quiz_strikes >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'strike_cap');
  END IF;

  v_streak  := v_prof.current_streak;
  v_longest := v_prof.longest_streak;
  v_freezes := v_prof.streak_freezes;

  IF p_action IN ('login','segregate','quiz_correct')
     AND (v_prof.last_activity_date IS DISTINCT FROM v_today)
     AND NOT (p_action = 'login' AND v_row.logged_in) THEN
    IF v_prof.last_activity_date = v_today - 1 THEN
      v_streak := v_streak + 1;
    ELSIF v_prof.last_activity_date = v_today - 2 AND v_freezes > 0 THEN
      v_freezes := v_freezes - 1; v_streak := v_streak + 1; v_freeze_used := true;
    ELSE
      v_streak := 1;
    END IF;
    v_longest := greatest(v_longest, v_streak);
    v_prof.last_activity_date := v_today;
  END IF;

  v_mult := least(2.0, 1 + 0.05 * v_streak);

  IF p_action = 'login' AND NOT v_row.logged_in THEN v_base := 1;
  ELSIF p_action = 'segregate' THEN v_base := 2;
  ELSIF p_action = 'quiz_correct' THEN v_base := 1;
  ELSE v_base := 0;
  END IF;
  v_award := round(v_base * v_mult);
  v_total := v_award;

  v_logged := v_row.logged_in OR p_action = 'login';
  v_segr   := v_row.segregated OR p_action = 'segregate';
  v_qc     := v_row.quizzes_correct + (CASE WHEN p_action = 'quiz_correct' THEN 1 ELSE 0 END);
  v_qs     := v_row.quiz_strikes + (CASE WHEN p_action = 'quiz_strike' THEN 1 ELSE 0 END);
  v_perfect := v_row.perfect_day;

  IF NOT v_perfect AND v_logged AND v_segr AND v_qc >= 1 THEN
    v_perfect := true; v_perfect_fired := true;
    v_total := v_total + round(5 * v_mult);
  END IF;

  IF p_action IN ('login','segregate','quiz_correct') AND v_streak IN (3,7,14,30)
     AND NOT EXISTS (SELECT 1 FROM public.streak_milestone_claims WHERE user_id = v_uid AND milestone = v_streak) THEN
    v_chest_reward := CASE v_streak WHEN 3 THEN 10 WHEN 7 THEN 20 WHEN 14 THEN 40 WHEN 30 THEN 100 END;
    v_chest_freeze := CASE WHEN v_streak IN (7,30) THEN 1 ELSE 0 END;
    INSERT INTO public.streak_milestone_claims (user_id, milestone) VALUES (v_uid, v_streak);
    v_total := v_total + v_chest_reward;
    v_freezes := v_freezes + v_chest_freeze;
    v_chest := jsonb_build_object('milestone', v_streak, 'reward', v_chest_reward, 'freeze', v_chest_freeze);
  END IF;

  UPDATE public.daily_activity SET
    logged_in = v_logged, segregated = v_segr, quizzes_correct = v_qc,
    quiz_strikes = v_qs, perfect_day = v_perfect, credits_earned = credits_earned + v_total
  WHERE user_id = v_uid AND activity_date = v_today;

  UPDATE public.profiles SET
    green_credits = green_credits + v_total,
    current_streak = v_streak, longest_streak = v_longest,
    last_activity_date = v_prof.last_activity_date, streak_freezes = v_freezes,
    updated_at = now()
  WHERE id = v_uid
  RETURNING green_credits INTO v_prof.green_credits;

  SELECT count(DISTINCT activity_date) INTO v_weekly
  FROM public.daily_activity
  WHERE user_id = v_uid AND activity_date > v_today - 7
    AND (logged_in OR segregated OR quizzes_correct > 0);

  RETURN jsonb_build_object(
    'ok', true, 'awarded', v_total, 'base', v_base, 'multiplier', v_mult,
    'current_streak', v_streak, 'longest_streak', v_longest,
    'perfect_day', v_perfect_fired, 'freezes', v_freezes, 'freeze_used', v_freeze_used,
    'chest', v_chest, 'green_credits', v_prof.green_credits,
    'caps', jsonb_build_object('quizzes_correct', v_qc, 'quiz_strikes', v_qs, 'segregated', v_segr, 'logged_in', v_logged),
    'weekly_active_days', v_weekly
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_daily_action(text) TO authenticated;

-- 8e. get_daily_status — read-only hydration for the ritual widget.
CREATE OR REPLACE FUNCTION public.get_daily_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := current_date;
  v_row public.daily_activity%ROWTYPE;
  v_prof public.profiles%ROWTYPE;
  v_weekly int;
  v_claims int[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_row FROM public.daily_activity WHERE user_id = v_uid AND activity_date = v_today;

  SELECT count(DISTINCT activity_date) INTO v_weekly
  FROM public.daily_activity
  WHERE user_id = v_uid AND activity_date > v_today - 7
    AND (logged_in OR segregated OR quizzes_correct > 0);

  SELECT coalesce(array_agg(milestone ORDER BY milestone), '{}') INTO v_claims
  FROM public.streak_milestone_claims WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true, 'activity_date', v_today,
    'logged_in', coalesce(v_row.logged_in, false),
    'segregated', coalesce(v_row.segregated, false),
    'quizzes_correct', coalesce(v_row.quizzes_correct, 0),
    'quiz_strikes', coalesce(v_row.quiz_strikes, 0),
    'perfect_day', coalesce(v_row.perfect_day, false),
    'credits_earned', coalesce(v_row.credits_earned, 0),
    'current_streak', coalesce(v_prof.current_streak, 0),
    'longest_streak', coalesce(v_prof.longest_streak, 0),
    'streak_freezes', coalesce(v_prof.streak_freezes, 0),
    'weekly_active_days', coalesce(v_weekly, 0),
    'claimed_milestones', to_jsonb(v_claims)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_status() TO authenticated;

-- 8f. set_crew_zone — admin-only write of a crew member's operating_zone.
-- profiles has no client UPDATE policy, so privileged writes go through this RPC.
CREATE OR REPLACE FUNCTION public.set_crew_zone(p_user_id uuid, p_zone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT role = 'admin' INTO v_is_admin FROM public.profiles WHERE id = v_uid;
  IF NOT coalesce(v_is_admin, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_admin');
  END IF;

  IF p_zone NOT IN ('Rishra', 'Howrah', 'Shyamnagar', 'Tarakeswar', 'Hugli-Chinsura') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_zone');
  END IF;

  UPDATE public.profiles
  SET operating_zone = p_zone, updated_at = now()
  WHERE id = p_user_id AND role IN ('crew', 'collector');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'crew_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'operating_zone', p_zone);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_crew_zone(uuid, text) TO authenticated;

-- 8g. set_payout_override — admin-only override of a pickup's final payout (money path).
-- RLS is row-level (can't gate these 3 columns alone while crew still update status), so the
-- privileged write goes through this RPC, mirroring set_crew_zone. p_amount NULL clears it.
CREATE OR REPLACE FUNCTION public.set_payout_override(p_pickup_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT role = 'admin' INTO v_is_admin FROM public.profiles WHERE id = v_uid;
  IF NOT coalesce(v_is_admin, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_admin');
  END IF;

  IF p_amount IS NOT NULL AND p_amount < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  UPDATE public.pickup_requests
  SET payout_override = p_amount,
      override_by = CASE WHEN p_amount IS NULL THEN NULL ELSE v_uid END,
      override_at = CASE WHEN p_amount IS NULL THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = p_pickup_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pickup_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'pickup_id', p_pickup_id, 'payout_override', p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_payout_override(uuid, numeric) TO authenticated;

-- ==========================================
-- TODO(RLS, later): the user will enable RLS + policies on the gamification/marketplace tables.
-- Staged here but INERT (commented out). Do NOT uncomment until policies are reviewed.
-- ==========================================
-- ALTER TABLE public.badges            ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_badges       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.redemption_orders ENABLE ROW LEVEL SECURITY;
--
-- -- badges + marketplace catalog: readable by everyone, writable by admins only.
-- CREATE POLICY "Anyone can read badges" ON public.badges FOR SELECT USING (true);
-- CREATE POLICY "Anyone can read marketplace items" ON public.marketplace_items FOR SELECT USING (true);
-- CREATE POLICY "Admins manage badges" ON public.badges FOR ALL
--   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- CREATE POLICY "Admins manage marketplace items" ON public.marketplace_items FOR ALL
--   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
--
-- -- user_badges: a user sees their own; admins see/grant all.
-- CREATE POLICY "Users read own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Admins manage user badges" ON public.user_badges FOR ALL
--   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
--
-- -- redemption_orders: a user sees their own (insert happens via SECURITY DEFINER RPC); admins manage all.
-- CREATE POLICY "Users read own orders" ON public.redemption_orders FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Admins manage orders" ON public.redemption_orders FOR ALL
--   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
