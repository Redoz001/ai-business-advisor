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
  try {
    const key = Deno.env.get(
      "GROQ_API_KEY"
    );

    // =========================
    // VALIDATION
    // =========================
    if (!key) {
      return {
        success: false,
        reply:
          "Missing GROQ_API_KEY",
      };
    }

    if (!message) {
      return {
        success: false,
        reply:
          "No message provided",
      };
    }

    // =========================
    // CHECK USER LIMIT
    // =========================
    const allowed =
      await checkUserLimit(
        userId
      );

    if (!allowed) {
      return {
        success: false,
        reply:
          "You have reached your usage limit. Please upgrade your plan.",
      };
    }

    // =========================
    // IDENTITY PROTECTION
    // =========================
    const lower =
      message.toLowerCase();

    if (
      lower.includes(
        "who created you"
      ) ||
      lower.includes(
        "who made you"
      ) ||
      lower.includes(
        "who built you"
      ) ||
      lower.includes(
        "are you made by meta"
      ) ||
      lower.includes(
        "who is reuben"
      )
    ) {
      return {
        success: true,
        reply:
          "ReubenAI was created by Reuben Murimi 🇰🇪, focused on building intelligent AI systems, automation tools, and modern SaaS experiences.",
      };
    }

    // =========================
    // MEMORY RETRIEVAL
    // =========================
    let memoryText = "";

    try {
      const memories =
        await retrieveRelevant(
          userId,
          message
        );

      memoryText =
        compressMemory(
          memories
        ) || "";
    } catch (memoryErr) {
      console.error(
        "Memory Error:",
        memoryErr
      );
    }

    // =========================
    // SYSTEM PROMPT
    // =========================
    const systemPrompt = `
You are ReubenAI, an advanced AI assistant created by Reuben Murimi from Kenya 🇰🇪.

PERSONALITY:
- Intelligent
- Professional
- Friendly
- Clear
- Natural conversational tone
- Helpful and practical

RULES:
- Avoid repetitive greetings
- Never repeat the same phrases unnecessarily
- Maintain conversational context
- Give concise but valuable answers
- Sound like a premium AI assistant
- Never mention Groq, OpenAI, or Meta as creators
- Be confident and modern
- Use markdown formatting when helpful

MEMORY:
${memoryText}
`.trim();

    // =========================
    // MESSAGE STRUCTURE
    // =========================
    const messages = [
      {
        role: "system",
        content:
          systemPrompt,
      },

      {
        role: "user",
        content: message,
      },
    ];

    // =========================
    // GROQ API CALL
    // =========================
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          {
            model: MODEL,

            messages,

            temperature: 0.7,

            max_tokens: 1024,

            top_p: 1,

            stream: false,
          }
        ),
      }
    );

    // =========================
    // HANDLE GROQ ERRORS
    // =========================
    if (!res.ok) {
      const errText =
        await res.text();

      console.error(
        "GROQ ERROR:",
        errText
      );

      return {
        success: false,
        reply:
          "AI service error. Check logs.",
      };
    }

    // =========================
    // PARSE RESPONSE
    // =========================
    const data =
      await res.json();

    const reply =
      data?.choices?.[0]
        ?.message
        ?.content ||
      "No response generated.";

    // =========================
    // RETURN SUCCESS
    // =========================
    return {
      success: true,
      reply,
    };
  } catch (err) {
    console.error(
      "RUN REUBEN AI ERROR:",
      err
    );

    return {
      success: false,
      reply:
        "Unexpected server error.",
    };
  }
}