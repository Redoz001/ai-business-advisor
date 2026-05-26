export function extractFacts(message: string) {
  const m = message.toLowerCase();
  const facts = [];

  if (m.includes("i am")) facts.push(`[FACT] ${message}`);
  if (m.includes("i want")) facts.push(`[GOAL] ${message}`);
  if (m.includes("my goal")) facts.push(`[GOAL] ${message}`);
  if (m.includes("i prefer")) facts.push(`[PREFERENCE] ${message}`);
  if (m.includes("i work on") || m.includes("building"))
    facts.push(`[PROJECT] ${message}`);

  return facts;
}

export function retrieveRelevant(
  memories: string[],
  message: string
) {
  const lower = message.toLowerCase();

  return memories.filter((m) =>
    lower
      .split(" ")
      .some((word) => m.toLowerCase().includes(word))
  );
}

export function compressMemory(memories: string[]) {
  return memories.slice(-10).join("\n");
}