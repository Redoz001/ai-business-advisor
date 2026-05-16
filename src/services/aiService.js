const SUPABASE_FUNCTION_URL =
  "https://whvzdutfyydshamwfhvu.supabase.co/functions/v1/reuben-ai";

async function forge(message) {
  try {
    const res = await fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        type: "text",
        content: data?.error || "Edge Function error",
      };
    }

    return {
      type: "text",
      content: data.reply,
    };
  } catch (err) {
    return {
      type: "text",
      content: "Network error: " + String(err),
    };
  }
}

export default { forge };