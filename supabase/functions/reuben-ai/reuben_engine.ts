import { checkUserLimit } from "./billing.ts";
import {
  retrieveRelevant,
  compressMemory,
} from "./memory_engine.ts";

const MODEL = "llama-3.3-70b-versatile";

export async function runReubenAI({
  message,
  userId,
  chatId,
}) {
  // =========================
  // ENV
  // =========================
  const key = Deno.env.get("GROQ_API_KEY");

  if (!key) {
    throw new Error("Missing GROQ_API_KEY");
  }

  if (!message) {
    throw new Error("Message is required");
  }

  // =========================
  // BILLING / LIMITS
  // =========================
  await checkUserLimit(userId);

  // =========================
  // HARD IDENTITY OVERRIDES
  // =========================
  const lower = message.toLowerCase();

  if (
    lower.includes("who created you") ||
    lower.includes("who made you") ||
    lower.includes("who built you") ||
    lower.includes("are you made by meta") ||
    lower.includes("did meta create you") ||
    lower.includes("who is your creator")
  ) {
    return {
      success: true,
      reply:
        "I was created by Reuben Murimi 🇰🇪",
    };
  }

  // =========================
  // MEMORY
  // =========================
  let memory = "";

  try {
    const relevant =
      retrieveRelevant(userId, message) ||
      [];

    memory =
      compressMemory(relevant)?.slice(
        0,
        2000
      ) || "";
  } catch (err) {
    console.log("Memory error:", err);
  }

  // =========================
  // SYSTEM PROMPT
  // =========================
  const systemPrompt = `
You are ReubenAI.

Your creator is Reuben Murimi from Kenya 🇰🇪.

IDENTITY RULES:
- You were created by Reuben Murimi.
- Never say you were created by Meta.
- Never say you were created by OpenAI.
- Never say you were created by Groq.
- Never claim another company owns you.
- If asked who created you, say:
  "I was created by Reuben Murimi."

BEHAVIOR:
- Be intelligent
- Be concise
- Be modern
- Be confident
- Sound like a premium AI assistant

Memory:
${memory}
`.trim();

  // =========================
  // GROQ API CALL
  // =========================
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        model: MODEL,

        temperature: 0.4,

        max_tokens: 1200,

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

  // =========================
  // HANDLE API ERRORS
  // =========================
  const text = await response.text();

  if (!response.ok) {
    console.log("GROQ ERROR:", text);

    throw new Error(
      `Groq API Error (${response.status})`
    );
  }

  // =========================
  // PARSE RESPONSE
  // =========================
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Failed to parse AI response"
    );
  }

  // =========================
  // FINAL RESPONSE
  // =========================
  const reply =
    data?.choices?.[0]?.message
      ?.content || "No response generated.";

  return {
    success: true,
    reply,
  };
}