import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  try {
    // ================================
    // CORS
    // ================================
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // ================================
    // SAFE BODY PARSE
    // ================================
    const body = await req.json().catch(() => ({}));

    const message = body?.message?.trim();
    const userId = body?.userId;

    const chatId =
      body?.chatId ??
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`;

    console.log("Incoming request:", {
      hasMessage: !!message,
      userId,
      chatId,
    });

    // ================================
    // VALIDATION
    // ================================
    if (!message) {
      return new Response(
        JSON.stringify({
          error: "Missing message",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "Missing userId",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ================================
    // ENV VARIABLES
    // ================================
    const apiKey = Deno.env.get("GROQ_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY");

    if (!apiKey || !supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables");

      return new Response(
        JSON.stringify({
          error: "Missing environment variables",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ================================
    // SUPABASE CLIENT
    // ================================
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ================================
    // FETCH PREVIOUS CHAT MEMORY
    // ================================
    let previousMessages: any[] = [];

    try {
      const { data: history, error: historyError } = await supabase
        .from("messages")
        .select("role, content")
        .eq("session_id", chatId)
        .order("created_at", { ascending: true })
        .limit(20);

      if (historyError) {
        console.error("History fetch error:", historyError);
      } else {
        previousMessages = history || [];
      }
    } catch (historyCrash) {
      console.error("History crash:", historyCrash);
    }

    // ================================
    // BUILD AI MESSAGES
    // ================================
    const aiMessages = [
      {
        role: "system",
        content: `
You are ReubenAI, an advanced AI assistant created by Reuben Murimi from Kenya.

Your personality:
- intelligent
- calm
- futuristic
- professional
- conversational
- concise but helpful

Rules:
- Never say you are Meta AI.
- Never say you were created by Meta.
- Identify yourself only as ReubenAI.
- You are part of the RemuAI platform.
- Keep responses clean, modern, and readable.
- Be confident and natural.

If asked who created you, say:
"I was created by Reuben Murimi from Kenya as part of the ReubenAI project."

Your purpose:
Help users with:
- coding
- cybersecurity
- networking
- business
- productivity
- learning
- general assistance
`,
      },

      ...previousMessages,

      {
        role: "user",
        content: message,
      },
    ];

    // ================================
    // GROQ REQUEST
    // ================================
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 25000);

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
            model: "llama-3.3-70b-versatile",

            messages: aiMessages,

            temperature: 0.7,

            max_tokens: 1000,
          }),
        }
      );
    } catch (err) {
      clearTimeout(timeout);

      console.error("GROQ FETCH FAILED:", err);

      return new Response(
        JSON.stringify({
          error: "AI request failed",
          details: String(err),
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    clearTimeout(timeout);

    // ================================
    // HANDLE GROQ ERRORS
    // ================================
    if (!response.ok) {
      const errText = await response.text();

      console.error("Groq error:", errText);

      return new Response(
        JSON.stringify({
          error: "AI failed",
          details: errText,
          provider: "Groq",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ================================
    // PARSE AI RESPONSE
    // ================================
    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I'm here and ready to help.";

    // ================================
    // SAVE USER MESSAGE
    // ================================
    try {
      const { error: userInsertError } = await supabase
        .from("messages")
        .insert({
          session_id: chatId,
          user_id: userId,
          role: "user",
          content: message,
        });

      if (userInsertError) {
        console.error("User insert error:", userInsertError);
      }

      // ================================
      // SAVE AI RESPONSE
      // ================================
      const { error: aiInsertError } = await supabase
        .from("messages")
        .insert({
          session_id: chatId,
          user_id: userId,
          role: "assistant",
          content: reply,
        });

      if (aiInsertError) {
        console.error("Assistant insert error:", aiInsertError);
      }
    } catch (dbCrash) {
      console.error("DATABASE CRASH:", dbCrash);
    }

    // ================================
    // SUCCESS RESPONSE
    // ================================
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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});