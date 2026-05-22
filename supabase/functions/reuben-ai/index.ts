Deno.serve(async (req) => {
  try {

    const { message, userId } = await req.json();
    const apiKey = Deno.env.get("GROQ_API_KEY");

    // =========================
    // 1. LOAD CHAT HISTORY
    // =========================
    const historyRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/chat_messages?user_id=eq.${userId}&select=role,content&order=created_at.asc`,
      {
        headers: {
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`
        }
      }
    );

    const historyData = await historyRes.json();

    const messages = [
      {
        role: "system",
        content: "You are Reuben AI, a smart assistant inside a SaaS system. Be concise, helpful, and intelligent."
      },

      ...(historyData || []),

      {
        role: "user",
        content: message
      }
    ];

    // =========================
    // 2. CALL GROQ API
    // =========================
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages,
        temperature: 0.7
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No response from AI";

    // =========================
    // 3. SAVE USER MESSAGE
    // =========================
    await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/chat_messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`
      },
      body: JSON.stringify([
        {
          user_id: userId,
          role: "user",
          content: message
        },
        {
          user_id: userId,
          role: "assistant",
          content: reply
        }
      ])
    });

    return new Response(
      JSON.stringify({ reply }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ reply: "AI backend error" }),
      { status: 500 }
    );
  }
});