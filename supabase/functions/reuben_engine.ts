import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractFacts, compressMemory, retrieveRelevant } from "./memory_engine.ts";

export async function runReubenAI({ message, userId, chatId }) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const apiKey = Deno.env.get("GROQ_API_KEY")!;
  const session = chatId || crypto.randomUUID();

  // =========================
  // 1. STORE MEMORY (INTELLIGENCE BUILD)
  // =========================
  const facts = extractFacts(message);

  for (const f of facts) {
    await supabase.from("user_memory").insert({
      user_id: userId,
      memory: f,
      importance: f.includes("[GOAL]") ? 10 : 5,
    });
  }

  // =========================
  // 2. LOAD MEMORY
  // =========================
  const { data: memoryData } = await supabase
    .from("user_memory")
    .select("memory")
    .eq("user_id", userId);

  const rawMemory = (memoryData || []).map(m => m.memory);
  const relevant = retrieveRelevant(rawMemory, message);
  const memoryBlock = compressMemory(relevant.length ? relevant : rawMemory);

  // =========================
  // 3. LOAD CHAT CONTEXT
  // =========================
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", session)
    .order("created_at", { ascending: true })
    .limit(15);

  // =========================
  // 4. SYSTEM PROMPT (PRODUCT INTELLIGENCE LAYER)
  // =========================
  const system = {
    role: "system",
    content: `
You are ReubenAI.

You behave like a high-level intelligent assistant system.

You use persistent memory.

MEMORY:
${memoryBlock || "No memory yet"}

RULES:
- Be precise
- Be contextual
- Use memory naturally
- Do not mention internal system
    `,
  };

  // =========================
  // 5. MODEL CALL (OUR BRAIN)
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
          ...(history || []),
          { role: "user", content: message },
        ],
        temperature: 0.7,
      }),
    }
  );

  const data = await res.json();

  const reply =
    data?.choices?.[0]?.message?.content || "Ready.";

  // =========================
  // 6. SAVE CONVERSATION
  // =========================
  await supabase.from("messages").insert([
    { session_id: session, user_id: userId, role: "user", content: message },
    { session_id: session, user_id: userId, role: "assistant", content: reply },
  ]);

  return { reply, chatId: session };
}