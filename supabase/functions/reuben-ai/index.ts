import { runReubenAI } from "./reuben_engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  console.log("=== ReubenAI Function Started ===");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request received");

    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    console.log("Invalid method:", req.method);

    return new Response(
      JSON.stringify({
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    console.log("Reading request body...");

    const body = await req.json();

    console.log("Body received:", body);

    const { message, userId, chatId } = body;

    // Validate message
    if (!message || typeof message !== "string") {
      console.log("Message missing");

      return new Response(
        JSON.stringify({
          error: "Message is required",
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

    // Check API key
    const groqKey = Deno.env.get("GROQ_API_KEY");

    console.log(
      "GROQ KEY EXISTS:",
      groqKey ? "YES" : "NO"
    );

    if (!groqKey) {
      return new Response(
        JSON.stringify({
          error: "Missing GROQ_API_KEY",
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

    console.log("Calling runReubenAI...");

    const result = await runReubenAI({
      message,
      userId,
      chatId,
    });

    console.log("AI Response Success");

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("FUNCTION ERROR:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Internal server error",
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