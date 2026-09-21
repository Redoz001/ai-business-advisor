const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

/**
 * Stream a chat completion from Groq using Server-Sent Events.
 * Yields raw delta strings as they arrive from the wire.
 */
export async function* askGroqStream(
  content: string,
  history: any[]
): AsyncGenerator<string> {
  const key = Deno.env.get("GROQ_API_KEY");

  if (!key) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const safeHistory = (history || [])
    .filter(
      (m) =>
        m &&
        typeof m.content === "string" &&
        typeof m.role === "string"
    )
    .slice(-15)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...safeHistory,
          { role: "user", content },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      console.error("GROQ STREAM ERROR:", data);
      throw new Error(data?.error?.message || "Groq API Error");
    }

    if (!res.body) {
      throw new Error("Groq stream returned no body");
    }

    const reader = res.body.getReader();

    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;

      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();

        buffer = buffer.slice(newlineIndex + 1);

        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();

        if (data === "[DONE]") return;

        try {
          const json = JSON.parse(data);

          const delta =
            json?.choices?.[0]?.delta?.content;

          if (delta) {
            yield delta;
          }
        } catch {
          // Ignore malformed keep-alive lines.
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

const SYSTEM_PROMPT = `
You are ReuNexus AI — a fast, accurate, intelligent assistant created by Reuben Murimi.

CORE PRINCIPLES:
- Give correct, helpful answers. Never invent facts, figures, quotes, names, or sources.
- If you are unsure, say so clearly and suggest how the user can verify or find the answer.
- Lead with the direct answer first, then add brief reasoning.
- Match the depth to the question: simple questions get short answers, complex ones get structured detail.
- Respectfully push back when a request is risky or rests on a wrong assumption.

STYLE:
- Clear, natural, professional writing. Plain language first.
- Use short paragraphs and scannable lists when structure helps.
- Use markdown (headings, bullets, code blocks) only when it genuinely improves readability.
- Never output JSON, logs, or raw system data unless the user explicitly asks.
- Never split words, echo streaming metadata, or repeat the greeting.

CONTEXT:
- Keep track of facts the user shares during this conversation and use them in follow-ups.
- When current, real-time information is needed and search context is provided, use it and clearly say it comes from a live search.

IDENTITY:
- Name: ReuNexus AI
- Creator: Reuben Murimi
- When compared with other AI assistants, stay objective, confident, and factual about your strengths without disparaging others.
`.trim();

export async function askGroq(content: string, history: any[]) {
  const key = Deno.env.get("GROQ_API_KEY");

  if (!key) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const safeHistory = (history || [])
    .filter(
      (m) =>
        m &&
        typeof m.content === "string" &&
        typeof m.role === "string"
    )
    .slice(-15)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const res = await fetch(
      GROQ_URL,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",

          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },

            ...safeHistory,

            {
              role: "user",
              content,
            },
          ],

          temperature: 0.7,
          max_tokens: 4096,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("GROQ ERROR:", data);

      throw new Error(
        data?.error?.message ||
          "Groq API Error"
      );
    }

    const output =
      data?.choices?.[0]?.message?.content;

    if (
      !output ||
      typeof output !== "string"
    ) {
      throw new Error(
        "Invalid response from Groq"
      );
    }

    return output.trim();
  } finally {
    clearTimeout(timeout);
  }
}