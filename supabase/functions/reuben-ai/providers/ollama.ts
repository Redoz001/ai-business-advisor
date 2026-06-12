export async function askOllama(content: string, history: any[]) {
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
      "http://localhost:11434/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer ollama",
        },
        body: JSON.stringify({
          model: "llama3",
          messages: [
            {
              role: "system",
              content: `
You are ReuNexus AI.

CORE PRINCIPLES:
- Be helpful, accurate, and logical
- Prefer simple, grounded reasoning
- If unsure, say so
- Do not hallucinate

IDENTITY:
- Name: ReuNexus AI
- Mode: Local (Ollama)
- Creator: Reuben Murimi
              `.trim(),
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
      console.error("OLLAMA ERROR:", data);
      throw new Error(data?.error?.message || "Ollama API Error");
    }

    const output = data?.choices?.[0]?.message?.content;

    if (!output || typeof output !== "string") {
      throw new Error("Invalid response from Ollama");
    }

    return output.trim();
  } finally {
    clearTimeout(timeout);
  }
}