INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'visual-assets',
  'visual-assets',
  false,
  52428800,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.visual_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL CHECK (char_length(prompt) <= 4000),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  source_path text,
  output_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visual_assets_user_created_idx
  ON public.visual_assets (user_id, created_at DESC);

ALTER TABLE public.visual_assets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.visual_assets TO authenticated;

DROP POLICY IF EXISTS "Users can read their own visual assets"
  ON public.visual_assets;
CREATE POLICY "Users can read their own visual assets"
  ON public.visual_assets
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own visual assets"
  ON public.visual_assets;
CREATE POLICY "Users can create their own visual assets"
  ON public.visual_assets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own visual assets"
  ON public.visual_assets;
CREATE POLICY "Users can delete their own visual assets"
  ON public.visual_assets
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access their visual asset files"
  ON storage.objects;
CREATE POLICY "Users can access their visual asset files"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'visual-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'visual-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );