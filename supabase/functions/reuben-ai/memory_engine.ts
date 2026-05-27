// Define a list of stop words to filter out during retrieval
// This prevents noisy matches on words that don't convey meaning
const STOP_WORDS = new Set(["i", "am", "the", "a", "an", "and", "or", "to", "my", "in", "on", "it", "that", "is"]);

export function extractFacts(message: string) {
  const m = message.toLowerCase();
  const facts: string[] = [];

  // Using a more structured check
  if (m.includes("i am")) facts.push(`[FACT] ${message}`);
  if (m.includes("i want") || m.includes("my goal")) facts.push(`[GOAL] ${message}`);
  if (m.includes("i prefer")) facts.push(`[PREFERENCE] ${message}`);
  if (m.includes("i work on") || m.includes("building")) facts.push(`[PROJECT] ${message}`);

  return [...new Set(facts)]; // Return unique facts only
}

export function retrieveRelevant(memories: string[], message: string) {
  const words = message.toLowerCase().split(/\s+/);
  
  // Only filter by words that carry meaning (not in STOP_WORDS)
  const significantWords = words.filter(word => word.length > 2 && !STOP_WORDS.has(word));

  return memories.filter((mem) => {
    const memLower = mem.toLowerCase();
    return significantWords.some((word) => memLower.includes(word));
  });
}

export function compressMemory(memories: string[]) {
  // Keep the most recent 10 items
  return memories.slice(-10).join("\n");
}