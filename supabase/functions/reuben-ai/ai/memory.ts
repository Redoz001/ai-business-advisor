export async function getMemory(supabase: any, userId: string) {
  if (!userId) return [];

  const { data: memory } = await supabase
    .from("reunexus_memory")
    .select("*")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .limit(30);

  const { data: feedback } = await supabase
    .from("reunexus_feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const memoryContext = (memory || []).map((m: any) => ({
    role: "system",
    content: `[MEM-${m.type}] ${m.content}`,
  }));

  const feedbackContext = (feedback || []).map((f: any) => ({
    role: "system",
    content: `[FEEDBACK rating=${f.rating}] ${f.correction || f.response}`,
  }));

  return [
    {
      role: "system",
      content:
        "You are ReuNexus AI with self-learning memory. Use past knowledge intelligently.",
    },
    ...memoryContext,
    ...feedbackContext,
  ];
}

/* =========================
   🧠 AUTO MEMORY EXTRACTOR
========================= */
export function extractLearning(message: string) {
  const m = message.toLowerCase();

  return {
    isFact:
      m.includes("my name is") ||
      m.includes("i am") ||
      m.includes("i live") ||
      m.includes("i work"),

    isPreference:
      m.includes("i like") ||
      m.includes("i prefer") ||
      m.includes("i want") ||
      m.includes("my favorite"),

    isCorrection:
      m.includes("wrong") ||
      m.includes("not correct") ||
      m.includes("actually") ||
      m.includes("better is"),
  };
}

/* =========================
   🧠 SAVE MEMORY (SMART)
========================= */
export async function saveMemory(
  supabase: any,
  userId: string,
  type: string,
  content: string
) {
  const importance =
    type === "fact" ? 3 :
    type === "preference" ? 2 :
    type === "correction" ? 3 :
    1;

  await supabase.from("reunexus_memory").insert({
    user_id: userId,
    type,
    content,
    importance,
  });
}

/* =========================
   🧠 FEEDBACK LEARNING
========================= */
export async function saveFeedback(
  supabase: any,
  userId: string,
  message: string,
  response: string,
  rating: number,
  correction?: string
) {
  await supabase.from("reunexus_feedback").insert({
    user_id: userId,
    message,
    response,
    rating,
    correction: correction || null,
  });
}