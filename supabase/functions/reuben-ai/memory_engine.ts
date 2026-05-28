export function retrieveRelevant(
  userId: string,
  message: string
) {
  // placeholder (upgrade later to vector DB)
  return [];
}

export function compressMemory(data: any[]) {
  return data
    .map((d) => d.content || "")
    .join("\n")
    .slice(0, 2000);
}