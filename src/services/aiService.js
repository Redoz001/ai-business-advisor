import { supabase } from "../lib/supabase.js";

export async function getAIStream({ message }) {
  const res = await fetch(
    "https://whvzdutfyydshamwfhvu.supabase.co/functions/v1/reuben-ai",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!res.ok) {
    throw new Error("API failed");
  }

  const data = await res.json();

  // fake stream (safe fallback)
  return (async function* () {
    yield data.reply;
  })();
}