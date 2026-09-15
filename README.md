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
