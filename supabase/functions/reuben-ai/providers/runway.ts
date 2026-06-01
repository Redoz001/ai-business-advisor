export async function generateVideo(prompt: string) {
  // placeholder for Runway / Pika / Sora API
  // you plug real API here later

  return {
    provider: "runway-ready",
    status: "queued",
    prompt,
    message:
      "Video generation system connected but not activated. Plug Runway API here.",
  };
}