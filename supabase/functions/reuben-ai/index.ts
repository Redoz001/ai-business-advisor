import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    // ---------------- CORS ----------------
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // ---------------- SAFE PARSE ----------------
    const body = await req.json().catch(() => ({}));

    const message = body?.message?.trim();
    const userId = body?.userId;
    const chatId = body?.chatId || crypto.randomUUID();

    // ---------------- DEBUG LOG (IMPORTANT) ----------------
    console.log("Incoming request:", { message, userId, chatId });

    // ---------------- VALIDATION (SAFE) ----------------
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Missing message" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ---------------- ENV ----------------
    const apiKey = Deno.env.get("GROQ_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing env variables" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---------------- GROQ REQUEST ----------------
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
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
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq error:", errText);

      return new Response(
        JSON.stringify({ error: "AI failed", details: errText }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response generated.";

    // ---------------- DATABASE SAVE (SAFE) ----------------
    const { error: dbError } = await supabase.from("chat_messages").insert([
      {
        session_id: chatId,
        user_id: userId,
        role: "user",
        content: message,
      },
      {
        session_id: chatId,
        user_id: userId,
        role: "assistant",
        content: reply,
      },
    ]);

    if (dbError) {
      console.error("DB insert error:", dbError);
    }

    // ---------------- RESPONSE ----------------
    return new Response(
      JSON.stringify({
        reply,
        chatId,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err) {
    console.error("FATAL ERROR:", err);

    return new Response(
      JSON.stringify({
        error: "Server crashed",
        details: err.message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});