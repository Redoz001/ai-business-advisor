export async function routeTools(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("image")) return { type: "image" };
  if (lower.includes("video")) return { type: "video" };
  if (lower.includes("search")) return { type: "search" };

  return null;
}