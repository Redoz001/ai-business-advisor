ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS requests_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requests_limit integer,
  ADD COLUMN IF NOT EXISTS request_reset_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles
SET
  plan = COALESCE(plan, 'normal'),
  subscription_tier = COALESCE(subscription_tier, 'normal'),
  account_tier = COALESCE(account_tier, 'normal'),
  subscription_status = COALESCE(subscription_status, 'inactive'),
  is_premium = COALESCE(is_premium, false),
  requests_used = COALESCE(requests_used, 0),
  request_reset_at = COALESCE(request_reset_at, now()),
  updated_at = now()
WHERE plan IS NULL
   OR subscription_tier IS NULL
   OR account_tier IS NULL
   OR subscription_status IS NULL
   OR is_premium IS NULL
   OR requests_used IS NULL
   OR request_reset_at IS NULL;
