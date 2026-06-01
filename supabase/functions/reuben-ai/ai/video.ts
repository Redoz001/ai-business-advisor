export async function videoTool(message: string) {
  if (!/video|animate/.test(message.toLowerCase())) return null;

  return {
    type: "video",
    status: "queued",
    provider: "runway/sora-ready",
  };
}