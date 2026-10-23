CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  message_id text,
  source text NOT NULL CHECK (source IN ('assistant_reply', 'sidebar')),
  rating text CHECK (rating IN ('up', 'down')),
  feedback text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_feedback_has_content CHECK (rating IS NOT NULL OR length(trim(feedback)) > 0)
);

CREATE INDEX IF NOT EXISTS ai_feedback_user_created_idx
  ON public.ai_feedback (user_id, created_at DESC);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.ai_feedback TO authenticated;

DROP POLICY IF EXISTS "Users can read their own AI feedback"
  ON public.ai_feedback;
CREATE POLICY "Users can read their own AI feedback"
  ON public.ai_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can submit their own AI feedback"
  ON public.ai_feedback;
CREATE POLICY "Users can submit their own AI feedback"
  ON public.ai_feedback
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      chat_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.chat_sessions AS chat_session
        WHERE chat_session.id = chat_id
          AND chat_session.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own AI feedback"
  ON public.ai_feedback;
CREATE POLICY "Users can update their own AI feedback"
  ON public.ai_feedback
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      chat_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.chat_sessions AS chat_session
        WHERE chat_session.id = chat_id
          AND chat_session.user_id = auth.uid()
      )
    )
  );
