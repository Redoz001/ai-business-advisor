export async function generateTitleIfNeeded(
  supabase: any,
  chatId: string,
  message: string
) {
  if (!chatId) return;

  const { count } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("session_id", chatId);

  if (count !== 1) return;

  const title = message.slice(0, 30);

  await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", chatId);
}