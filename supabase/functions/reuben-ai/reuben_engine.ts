import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function runReubenAI({
  message,
  userId,
  chatId,
}) {
  // LOAD MEMORY (last 20 messages)
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", chatId)
    .order("created_at", { ascending: true })
    .limit(20);

  const context = (history || [])
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `
You are ReubenAI.

You are helpful, intelligent, and concise.

Conversation:
${context}

User: ${message}
AI:
`;

  // GROQ (FAST + FREE OPTION)
  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are ReubenAI, a production-grade assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  const data = await res.json();

  const reply =
    data?.choices?.[0]?.message?.content ||
    "No response";

  return { reply };
}