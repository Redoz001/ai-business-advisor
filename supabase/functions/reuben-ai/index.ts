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

    // ---------------- SAFE BODY PARSE ----------------
    const body = await req.json().catch(() => ({}));

    const message = body?.message?.trim();
    const userId = body?.userId;

    const chatId =
      body?.chatId ??
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`;

    console.log("Incoming request:", { message, userId, chatId });

    // ---------------- VALIDATION ----------------
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
      console.error("Missing env vars");
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---------------- GROQ REQUEST (WITH TIMEOUT) ----------------
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response;

    try {
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model:"llama-3.3-70b-versatile",
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
    } catch (err) {
      clearTimeout(timeout);
      console.error("GROQ FETCH FAILED:", err);

      return new Response(
        JSON.stringify({
          error: "AI request failed (timeout or network error)",
          details: String(err),
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq error:", errText);

      return new Response(
        JSON.stringify({
          error: "AI failed",
          details: errText,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response generated.";

    // ---------------- DATABASE INSERT (SAFE, SEPARATE ROWS) ----------------
    try {
      const { error: userErr } = await supabase.from("messages").insert({
        session_id: chatId,
        user_id: userId,
        role: "user",
        content: message,
      });

      if (userErr) console.error("User insert error:", userErr);

      const { error: aiErr } = await supabase.from("messages").insert({
        session_id: chatId,
        user_id: userId,
        role: "assistant",
        content: reply,
      });

      if (aiErr) console.error("Assistant insert error:", aiErr);
    } catch (dbCrash) {
      console.error("DB CRASH:", dbCrash);
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
    console.error("STACK:", err?.stack);

    return new Response(
      JSON.stringify({
        error: "Server crashed",
        details: String(err),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});