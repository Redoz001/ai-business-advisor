export async function imageTool(message: string) {
  const lower = message.toLowerCase();

  if (!/image|draw|generate/.test(lower)) return null;

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (Deno.env.get("OPENAI_ENABLED") !== "true" || !apiKey) return null;

  const enrichedPrompt = [
    message.trim(),
    "photorealistic",
    "ultra-detailed",
    "cinematic lighting",
    "high realism",
    "sharp focus",
    "clean composition",
    "no distortion",
    "no blemishes",
    "premium quality",
    "natural skin texture",
    "refined color grading",
  ].join(", ");

  const res = await fetch(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: enrichedPrompt,
        size: "1024x1024",
        quality: "high",
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "OpenAI image generation failed.");
  }

  const imageData = data?.data?.[0];
  if (imageData?.b64_json) {
    return {
      type: "image",
      url: `data:image/png;base64,${imageData.b64_json}`,
    };
  }

  return {
    type: "image",
    url: imageData?.url || null,
  };
}