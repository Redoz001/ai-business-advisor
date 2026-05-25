import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const body = await req.json().catch(() => null);

    if (!body?.message || !body?.userId) {
      return new Response(
        JSON.stringify({ error: "Missing message or userId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { message, userId, chatId } = body;

    const apiKey = Deno.env.get("GROQ_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---------------- AI REQUEST ----------------
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content: "You are Reuben AI, a helpful assistant.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: "AI failed", details: err }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response generated.";

    const sessionId = chatId || crypto.randomUUID();

    // ---------------- SAVE TO DB ----------------
    await supabase.from("chat_messages").insert([
      {
        session_id: sessionId,
        user_id: userId,
        role: "user",
        content: message,
      },
      {
        session_id: sessionId,
        user_id: userId,
        role: "assistant",
        content: reply,
      },
    ]);

    return new Response(
      JSON.stringify({ reply, chatId: sessionId }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server crashed", details: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});