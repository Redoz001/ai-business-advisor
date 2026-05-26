import { supabase } from "../lib/supabase.js";

export async function getAIStream({ message, userId, chatId }) {
  const res = await fetch(
    "https://whvzdutfyydshamwfhvu.supabase.co/functions/v1/reuben-ai",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        userId,
        chatId,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("API Error:", errorText);

    throw new Error("API failed");
  }

  const data = await res.json();

  console.log("AI RESPONSE:", data);

  // support multiple backend formats safely
  const finalReply =
    data.reply ||
    data.response ||
    data.message ||
    data.content ||
    "No AI response";

  return (async function* () {
    yield finalReply;
  })();
}