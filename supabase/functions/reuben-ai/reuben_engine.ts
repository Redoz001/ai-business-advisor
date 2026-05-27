import {
  compressMemory,
  extractFacts,
  retrieveRelevant,
} from "./memory_engine.ts";

function getSystemPrompt(memoryBlock: string) {
  return {
    role: "system",
    content: `
You are ReubenAI, an advanced AI assistant created by Reuben Murimi.

MEMORY:
${memoryBlock || "No memory available"}

Speak naturally and helpfully.
    `.trim(),
  };
}

const memories: string[] = [];

export async function runReubenAI({
  message,
  userId,
  chatId,
}: {
  message: string;
  userId?: string;
  chatId?: string;
}) {
  // Retrieve relevant memory
  const relevant = retrieveRelevant(
    memories,
    message
  );

  const memoryBlock =
    compressMemory(relevant);

  // Extract new facts
  const newFacts = extractFacts(message);

  memories.push(...newFacts);

  const groqKey = Deno.env.get(
    "GROQ_API_KEY"
  );

  if (!groqKey) {
    throw new Error(
      "Missing GROQ_API_KEY"
    );
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          getSystemPrompt(memoryBlock),
          {
            role: "user",
            content: message,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  return {
    success: true,
    reply:
      data?.choices?.[0]?.message
        ?.content ||
      "No response generated.",
  };
}