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
  // =========================
  // Environment Validation
  // =========================

  const groqKey = Deno.env.get("GROQ_API_KEY");

  if (!groqKey) {
    throw new Error(
      "GROQ_API_KEY is not set in Supabase Secrets."
    );
  }

  // =========================
  // Input Validation
  // =========================

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
    console.error(
      "MEMORY_RETRIEVAL_ERROR:",
      err
    );
  }

  let memoryBlock = "";

  try {
    memoryBlock =
      compressMemory(relevant) || "";
  } catch (err) {
    console.error(
      "MEMORY_COMPRESSION_ERROR:",
      err
    );
  }

  // =========================
  // Timeout Protection
  // =========================

  const controller =
    new AbortController();

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
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model:
            "llama-3.3-70b-versatile",

          messages: [
            {
              role: "system",
              content: memoryBlock
                ? `Memory:\n${memoryBlock}`
                : "You are ReubenAI, a helpful AI assistant.",
            },
            {
              role: "user",
              content: message,
            },
          ],

          temperature: 0.7,
          max_tokens: 1024,
        }),
      }
    );

    // =========================
    // Read Raw Response
    // =========================

    const rawText =
      await response.text();

    // =========================
    // Handle API Errors
    // =========================

    if (!response.ok) {
      console.error(
        "GROQ_API_ERROR:",
        response.status,
        rawText
      );

      throw new Error(
        `Groq API Error (${response.status}): ${rawText}`
      );
    }

    // =========================
    // Safe JSON Parsing
    // =========================

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

    // =========================
    // Extract Reply
    // =========================

    const reply =
      data?.choices?.[0]?.message
        ?.content;

    return {
      success: true,
      reply:
        reply ||
        "No response generated.",
    };
  } catch (err) {
    console.error(
      "RUN_REUBEN_AI_ERROR:",
      err
    );

    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}