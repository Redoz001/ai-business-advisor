export async function getAIResponse({
  message,
  userId,
  chatId,
}) {
  try {
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

    // Safe JSON parsing
    const data = await res.json().catch(() => ({}));

    // Better backend error handling
    if (!res.ok) {
      console.error("AI Service Error:", data);

      throw new Error(
        data?.details ||
        data?.error ||
        "AI request failed"
      );
    }

    // Ensure reply exists
    if (!data?.reply) {
      throw new Error("No AI reply returned");
    }

    return data;
  } catch (err) {
    console.error("getAIResponse crash:", err);

    throw new Error(
      err?.message || "Failed to contact AI server"
    );
  }
}