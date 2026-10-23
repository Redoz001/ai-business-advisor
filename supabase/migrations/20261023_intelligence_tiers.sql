-- Intelligence tier system
-- free tier: completely free, less intelligence (basic AI), limited requests
-- intelligence tier: paid, full intelligence, unlimited requests

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intelligence_level text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS requests_limit integer NOT NULL DEFAULT 10;

UPDATE public.profiles
SET
  intelligence_level = COALESCE(intelligence_level, 'basic'),
  requests_limit = COALESCE(requests_limit, 10),
  updated_at = now()
WHERE intelligence_level IS NULL
   OR requests_limit IS NULL;

-- Index for tier lookups
CREATE INDEX IF NOT EXISTS profiles_intelligence_level_idx
  ON public.profiles (intelligence_level);

CREATE INDEX IF NOT EXISTS profiles_plan_idx
  ON public.profiles (plan);
