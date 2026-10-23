CREATE TABLE IF NOT EXISTS public.studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('website', 'pwa', 'game', 'android')),
  prompt text NOT NULL,
  files jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_projects_user_updated_idx
  ON public.studio_projects (user_id, updated_at DESC);

ALTER TABLE public.studio_projects ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.studio_projects
  TO authenticated;

DROP POLICY IF EXISTS "Users can read their own studio projects"
  ON public.studio_projects;
CREATE POLICY "Users can read their own studio projects"
  ON public.studio_projects
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own studio projects"
  ON public.studio_projects;
CREATE POLICY "Users can create their own studio projects"
  ON public.studio_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own studio projects"
  ON public.studio_projects;
CREATE POLICY "Users can update their own studio projects"
  ON public.studio_projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own studio projects"
  ON public.studio_projects;
CREATE POLICY "Users can delete their own studio projects"
  ON public.studio_projects
  FOR DELETE
  USING (auth.uid() = user_id);
