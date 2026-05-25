export async function getAIResponse(message, userId, chatId) {
  const res = await fetch(
    "https://whvzdutfyydshamwfhvu.supabase.co/functions/v1/reuben-ai",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        userId,
        chatId,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "AI request failed");
  }

  return data.reply;
}