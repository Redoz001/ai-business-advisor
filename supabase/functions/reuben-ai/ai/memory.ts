export async function getMemory(supabase: any, chatId: string) {
  if (!chatId) return [];

  const { data } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", chatId)
    .order("created_at", { ascending: true })
    .limit(30);

  return (data || []).map((m: any) => ({
    role: m.role,
    content: m.content,
  }));
}