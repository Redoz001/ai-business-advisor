export async function askOpenAI(content: string, history: any[]) {
  const key = Deno.env.get("OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: "You are Reuben AI (deep reasoning brain).",
        },
        ...history,
        { role: "user", content },
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error("OpenAI Error");
  }

  return data.choices[0].message.content;
}