const SUPABASE_URL =
  "https://whvzdutfyydshamwfhvu.functions.supabase.co/reuben-ai";

async function forge(message, onChunk) {
  try {
    const res = await fetch(SUPABASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    const reply = data.reply || "No response";

    // optional streaming effect
    if (onChunk) {
      let text = "";
      for (let i = 0; i < reply.length; i++) {
        text += reply[i];
        onChunk(text);
        await new Promise((r) => setTimeout(r, 5));
      }
    }

    return {
      type: "text",
      content: reply,
    };
  } catch (err) {
    return {
      type: "text",
      content: "Edge Function error: " + String(err),
    };
  }
}

export default { forge };