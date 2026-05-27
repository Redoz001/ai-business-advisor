// Lightweight memory engine for ReubenAI

// Common low-value words ignored during retrieval
const STOP_WORDS = new Set([
  "i",
  "am",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "my",
  "in",
  "on",
  "it",
  "that",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "of",
  "for",
  "with",
  "this",
  "you",
  "me",
]);

// Extract useful long-term memory facts
export function extractFacts(message: string): string[] {
  const original = message.trim();
  const m = original.toLowerCase();

  const facts: string[] = [];

  // Identity
  if (
    m.includes("i am") ||
    m.includes("i'm")
  ) {
    facts.push(`[IDENTITY] ${original}`);
  }

  // Goals
  if (
    m.includes("i want") ||
    m.includes("my goal") ||
    m.includes("i plan") ||
    m.includes("i hope")
  ) {
    facts.push(`[GOAL] ${original}`);
  }

  // Preferences
  if (
    m.includes("i prefer") ||
    m.includes("i like") ||
    m.includes("i love")
  ) {
    facts.push(`[PREFERENCE] ${original}`);
  }

  // Projects
  if (
    m.includes("building") ||
    m.includes("working on") ||
    m.includes("creating") ||
    m.includes("developing")
  ) {
    facts.push(`[PROJECT] ${original}`);
  }

  // Skills / work
  if (
    m.includes("i work") ||
    m.includes("my job") ||
    m.includes("i study")
  ) {
    facts.push(`[BACKGROUND] ${original}`);
  }

  // Remove duplicates
  return [...new Set(facts)];
}

// Retrieve relevant memories using lightweight scoring
export function retrieveRelevant(
  memories: string[],
  message: string,
  limit = 5
): string[] {
  const words = message
    .toLowerCase()
    .split(/\W+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word)
    );

  const scored = memories.map((memory) => {
    const memLower = memory.toLowerCase();

    let score = 0;

    for (const word of words) {
      if (memLower.includes(word)) {
        score += 1;
      }
    }

    // Slight boost for project memories
    if (memory.startsWith("[PROJECT]")) {
      score += 1;
    }

    // Slight boost for goals
    if (memory.startsWith("[GOAL]")) {
      score += 1;
    }

    return {
      memory,
      score,
    };
  });

  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((m) => m.memory);
}

// Compress memory safely for prompt injection
export function compressMemory(
  memories: string[],
  maxItems = 12
): string {
  // Remove duplicates while preserving order
  const unique = [...new Set(memories)];

  // Keep recent memories only
  const trimmed = unique.slice(-maxItems);

  return trimmed.join("\n");
}