import { checkUserLimit } from "./billing.ts";
import {
  retrieveRelevant,
  compressMemory,
} from "./memory_engine.ts";

const MODEL = "llama-3.3-70b-versatile";

export async function runReubenAI({
  message,
  userId,
}) {
  const key = Deno.env.get("GROQ_API_KEY");

  if (!key) throw new Error("Missing API key");

  // =========================
  // BILLING CHECK (IMPORTANT)
  // =========================
  await checkUserLimit(userId);

  // =========================
  // MEMORY
  // =========================
  let memory = "";

  try {
    const relevant =
      retrieveRelevant(userId, message) || [];

    memory =
      compressMemory(relevant) || "";
  } catch {}

  // =========================
  // SYSTEM PROMPT
  // =========================
  const systemPrompt = `
You are ReubenAI 🇰🇪.
Created by Reuben Murimi.

Be helpful, concise, and intelligent.

Memory:
${memory}
`.trim();

  // =========================
  // GROQ CALL
  // =========================
  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    }
  );

  const data = await res.json();

  return {
    success: true,
    reply:
      data?.choices?.[0]?.message
        ?.content || "",
  };
}