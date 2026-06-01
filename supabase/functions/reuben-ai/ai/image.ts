export async function imageTool(message: string) {
  const lower = message.toLowerCase();

  if (!/image|draw|generate/.test(lower)) return null;

  const res = await fetch(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: message,
        size: "1024x1024",
      }),
    }
  );

  const data = await res.json();

  return {
    type: "image",
    url: data?.data?.[0]?.url || null,
  };
}