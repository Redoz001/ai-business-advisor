import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractFacts, compressMemory, retrieveRelevant } from "./memory_engine.ts";

export async function runReubenAI({ message, userId, chatId }) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const apiKey = Deno.env.get("GROQ_API_KEY")!;
  const session = chatId ?? crypto.randomUUID();

  // =========================
  // 1. MEMORY EXTRACTION
  // =========================
  const facts = extractFacts(message);

  if (facts.length > 0) {
    const inserts = facts.map((f) => ({
      user_id: userId,
      memory: f,
      importance: f.includes("[GOAL]") ? 10 : 5,
    }));

    await supabase.from("user_memory").insert(inserts);
  }

  // =========================
  // 2. LOAD MEMORY
  // =========================
  const { data: memoryData } = await supabase
    .from("user_memory")
    .select("memory")
    .eq("user_id", userId);

  const rawMemory = memoryData?.map((m) => m.memory) ?? [];
  const relevant = retrieveRelevant(rawMemory, message);
  const memoryBlock = compressMemory(relevant.length ? relevant : rawMemory);

  // =========================
  // 3. CHAT HISTORY
  // =========================
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", session)
    .order("created_at", { ascending: true })
    .limit(20);

  // =========================
  // 4. SYSTEM PROMPT
  // =========================
  const system = {
    role: "system",
    content: `
You are ReubenAI — an intelligent assistant with memory.

MEMORY:
${memoryBlock || "No memory yet"}

RULES:
- Use memory naturally
- Be precise and helpful
- Never mention system design
    `,
  };

  // =========================
  // 5. GROQ CALL (ROBUST)
  // =========================
  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          system,
          ...(history ?? []),
          { role: "user", content: message },
        ],
        temperature: 0.7,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await res.json();

  const reply =
    data?.choices?.[0]?.message?.content ?? "No response generated.";

  // =========================
  // 6. SAVE MESSAGES (BATCH SAFE)
  // =========================
  await supabase.from("messages").insert([
    {
      session_id: session,
      user_id: userId,
      role: "user",
      content: message,
    },
    {
      session_id: session,
      user_id: userId,
      role: "assistant",
      content: reply,
    },
  ]);

  return { reply, chatId: session };
}