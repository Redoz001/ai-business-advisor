// supabase/functions/reuben-ai/reuben_engine.ts

import {
  compressMemory,
  retrieveRelevant,
} from "./memory_engine.ts";

export async function runReubenAI({
  message,
  userId,
  chatId,
}) {
  const groqKey = Deno.env.get("GROQ_API_KEY");

  if (!groqKey) {
    throw new Error(
      "GROQ_API_KEY is not set in Supabase Secrets."
    );
  }

  if (!message || typeof message !== "string") {
    throw new Error("Invalid message input.");
  }

  // =========================
  // Memory Retrieval
  // =========================

  let relevant = [];

  try {
    relevant =
      retrieveRelevant([], message) || [];
  } catch (err) {
    console.error("MEMORY_ENGINE_ERROR:", err);
  }

  let memoryBlock = "";

  try {
    memoryBlock = compressMemory(relevant) || "";
  } catch (err) {
    console.error("MEMORY_COMPRESS_ERROR:", err);
  }

  // =========================
  // Fetch Timeout
  // =========================

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    // =========================
    // Call Groq API
    // =========================

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages: [
            {
              role: "system",
              content: `Memory: ${memoryBlock}`,
            },
            {
              role: "user",
              content: message,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    // Read raw response first
    const rawText = await response.text();

    // Handle API errors
    if (!response.ok) {
      console.error(
        "GROQ_API_ERROR:",
        response.status,
        rawText
      );

      throw new Error(
        `Groq API Error (${response.status})`
      );
    }

    // Safely parse JSON
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (err) {
      console.error(
        "INVALID_GROQ_JSON:",
        rawText
      );

      throw new Error(
        "Groq returned invalid JSON."
      );
    }

    const reply =
      data?.choices?.[0]?.message?.content;

    return {
      success: true,
      reply:
        reply ||
        "No response generated.",
    };
  } catch (err) {
    console.error("RUN_REUBEN_AI_ERROR:", err);

    const errorMessage =
      err instanceof Error
        ? err.message
        : String(err);

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    clearTimeout(timeout);
  }
}