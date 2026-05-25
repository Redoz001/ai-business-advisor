import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    // =========================
    // CORS PRE-FLIGHT
    // =========================
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // =========================
    // PARSE BODY SAFELY
    // =========================
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { message, userId, history = [] } = body || {};

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing message or userId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =========================
    // ENV CHECK
    // =========================
    const apiKey = Deno.env.get("VITE_GROQ_API_KEY");
    const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL");
    const supabaseKey = Deno.env.get("VITE_SUPABASE_ANON_KEY");

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========================
    // FORMAT HISTORY PROPERLY (FIX IMPORTANT BUG)
    // =========================
    const formattedHistory = Array.isArray(history)
      ? history
          .filter((m) => m?.role && m?.content)
          .slice(-20)
      : [];

    const messages = [
      {
        role: "system",
        content:
          "You are Reuben AI, a smart, helpful, concise AI assistant.",
      },
      ...formattedHistory,
      {
        role: "user",
        content: message,
      },
    ];

    // =========================
    // GROQ REQUEST (SAFE)
    // =========================
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
          messages,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("GROQ ERROR:", errText);

      return new Response(
        JSON.stringify({
          error: "AI model failed",
          details: errText,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I could not generate a response.";

    // =========================
    // SAVE TO DATABASE (SAFE INSERT)
    // =========================
    try {
      await supabase.from("chat_messages").insert([
        {
          user_id: userId,
          chat_id: body.chatId || crypto.randomUUID(),
          role: "user",
          content: message,
        },
        {
          user_id: userId,
          chat_id: body.chatId || crypto.randomUUID(),
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (dbErr) {
      console.error("DB SAVE ERROR:", dbErr);
    }

    // =========================
    // SUCCESS RESPONSE
    // =========================
    return new Response(
      JSON.stringify({
        reply,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("FATAL ERROR:", error);

    return new Response(
      JSON.stringify({
        error: "Edge Function crashed",
        details: error.message,
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});