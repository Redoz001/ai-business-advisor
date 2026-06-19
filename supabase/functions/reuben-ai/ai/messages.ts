export async function getSessionHistory(
  supabase: any,
  chatId: string
) {
  if (!chatId) return [];

  const { data, error } =
    await supabase
      .from("reunexus_messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", {
        ascending: true,
      })
      .limit(30);

  if (error) {
    console.error(
      "History load failed:",
      error
    );
    return [];
  }

  return data || [];
}

export async function saveMessage(
  supabase: any,
  chatId: string,
  userId: string,
  role: string,
  content: string
) {
  if (!chatId || !content) return;

  const { error } =
    await supabase
      .from("reunexus_messages")
      .insert({
        chat_id: chatId,
        user_id: userId,
        role,
        content,
      });

  if (error) {
    console.error(
      "Message save failed:",
      error
    );
  }
}