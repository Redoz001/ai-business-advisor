// supabase/functions/reuben-ai/index.ts

import { runReubenAI } from "./reuben_engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // Safely parse JSON
    let body;

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON body",
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

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const userId = body.userId ?? null;
    const chatId = body.chatId ?? null;

    // Validate required fields
    if (!message || !userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing message or userId",
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

    console.log("Incoming Request:", {
      message,
      userId,
      chatId,
    });

    const result = await runReubenAI({
      message,
      userId,
      chatId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("EDGE_FUNCTION_ERROR:", err);

    const errorMessage =
      err instanceof Error ? err.message : String(err);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
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