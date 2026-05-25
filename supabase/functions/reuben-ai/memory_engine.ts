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