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
    // PARSE BODY
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

    const { message, userId, history = [] } = body;

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing message or userId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =========================
    // ENV VARIABLES
    // =========================
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

    // =========================
    // CHAT ID (FIXED BUG)
    // =========================
    const chatId = body.chatId || crypto.randomUUID();

    // =========================
    // FORMAT HISTORY
    // =========================
    const formattedHistory = Array.isArray(history)
      ? history.filter((m) => m?.role && m?.content).slice(-20)
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
    // GROQ REQUEST
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
          model: "llama-3.3-70b-versatile",
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
          error: "AI request failed",
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
    // SAVE TO SUPABASE (FIXED)
    // =========================
    const { error: dbError } = await supabase
      .from("chat_messages")
      .insert([
        {
          user_id: userId,
          chat_id: chatId,
          role: "user",
          content: message,
        },
        {
          user_id: userId,
          chat_id: chatId,
          role: "assistant",
          content: reply,
        },
      ]);

    if (dbError) {
      console.error("DB SAVE ERROR:", dbError);
    }

    // =========================
    // RESPONSE
    // =========================
    return new Response(
      JSON.stringify({
        reply,
        chatId,
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
        error: "Server crashed",
        details: error.message,
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});