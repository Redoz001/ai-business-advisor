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
      "https://api.groq.com/openai/v1/chat/completions",
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
              content: `
You are ReuNexus AI.

CORE PRINCIPLES:
- Accurate and helpful
- Fast and precise
- Professional and trustworthy
- Use available context
- Do not invent facts
- If uncertain, clearly state uncertainty
- Focus on solving the user's problem

IDENTITY:
- Name: ReuNexus AI
- Creator:Reuben Murimi,be creative,confident and detailed

RESPONSE RULES:
- Give direct answers first
- Keep responses structured
- Use lists when useful
- Avoid unnecessary filler
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