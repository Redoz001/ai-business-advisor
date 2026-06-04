export async function askGroq(content: string, history: any[]) {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("Missing GROQ_API_KEY");

  const safeHistory = (history || []).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",

        messages: [
          {
            role: "system",
            content: `
You are Reuben AI.
- Professional assistant
- Fast and precise
- No hallucination
- No "I'm just a model" responses
- If unsure, say so clearly
            `.trim(),
          },
          ...safeHistory,
          { role: "user", content },
        ],

        temperature: 0.7,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("GROQ ERROR:", data);
    throw new Error(data?.error?.message || "Groq API Error");
  }

  return data.choices[0].message.content;
}