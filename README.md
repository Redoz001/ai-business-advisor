# ai-business-advisor

## Local env setup

Copy the example environment file and fill in your actual project values:

```bash
cp .env.example .env
```

Required variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LOCAL_AI=false
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3
VITE_FREE_MESH=false
```

## Vercel deployment

- Import the GitHub repo into Vercel.
- In Project Settings > Environment Variables, add the same values above.
- Keep the default Vite build settings or use the repository's existing `vercel.json`.

## Supabase setup

- Create or connect the Supabase project.
- Add the same URL and anon key values to Vercel's environment variables.
- Ensure your Edge Function is deployed and the frontend calls `supabase.functions.invoke("reuben-ai")` with the proper URL and anon key.

## Avatar behavior

The avatar is intentionally not a static statue. The 3D scene includes continuous breathing, gaze drift, blinking, subtle head motion, and fallback idle motion so it stays alive even when the source GLB has no usable idle clip.

## Build Studio

Open **Build Studio** from the chat sidebar to generate and save responsive websites, installable PWAs, browser games, or Expo-based native iOS and Android app source. Generated files can be edited in the Studio and exported together as a ZIP archive. PWA and native projects include local testing guidance; the sandboxed web preview cannot test PWA installation/offline behavior or run native apps. Native app projects must be run locally with Expo and are not compiled, signed, or published by the Studio. Apply `supabase/migrations/20261022_build_studio.sql` to enable saved projects. Apply `supabase/migrations/20261022_ai_feedback.sql` to enable per-reply ratings and feedback submission. Feedback notifications are sent to the configured feedback inbox by the `feedback-notification` Edge Function using Resend; configure `RESEND_API_KEY` and a verified `FEEDBACK_FROM_EMAIL` sender with `supabase secrets set`.

To apply the Studio database setup to the linked Supabase project, run `supabase db push --linked` from the repository root after reviewing the pending migrations. The migration grants authenticated users access to the table and uses row-level security so users can only access their own projects. The Studio currently exports source projects; hosting deployment is not configured.

To email submitted feedback to `redozmuriz81@gmail.com`, configure a Resend API key and a sender address on a domain verified in Resend, then deploy the notification function:

```bash
supabase secrets set RESEND_API_KEY=re_your_api_key FEEDBACK_FROM_EMAIL="ReuNexus Feedback <feedback@your-verified-domain.com>"
supabase functions deploy feedback-notification
```
