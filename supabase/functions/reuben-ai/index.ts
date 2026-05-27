import { runReubenAI } from "./reuben_engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
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
    // Parse body
    const body = await req.json();

    const {
      message,
      userId,
      chatId,
    } = body;

    // Validate message
    if (!message) {
      return new Response(
        JSON.stringify({
          success: false,
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

    // Run AI engine
    const result = await runReubenAI({
      message,
      userId,
      chatId,
    });

    console.log("AI RESULT:", JSON.stringify(result, null, 2));

    // --- UPDATED ERROR HANDLING ---
    // If the engine returns an error (e.g., Quota exceeded), surface it.
    if (result?.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: typeof result.error === 'string' ? result.error : (result.error.message || "AI Service Error"),
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

    // Normalize reply
    const reply =
      result?.reply ||
      result?.content ||
      result?.message ||
      result?.data?.reply ||
      result?.data?.content ||
      "No response generated.";

    // Send success response
    return new Response(
      JSON.stringify({
        success: true,
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