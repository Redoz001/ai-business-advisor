export async function searchTool(message: string) {
  if (!/search|news|latest/.test(message.toLowerCase())) return null;

  return {
    type: "search",
    query: message,
    results: [],
  };
}