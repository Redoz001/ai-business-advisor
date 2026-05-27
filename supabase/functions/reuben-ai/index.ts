import { runReubenAI } from "./reuben_engine.ts";

// Updated to use your specific domain and added Max-Age for preflight caching
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.remuai.space", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
};

Deno.serve(async (req) => {
  // 1. Handle OPTIONS (preflight) request immediately
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204, // 204 is the standard success code for preflight
      headers: corsHeaders,
    });
  }

  // 2. Allow ONLY POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const message = body?.message?.trim();
    const userId = body?.userId;
    const chatId = body?.chatId;

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await runReubenAI({
      message,
      userId,
      chatId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in ReubenAI function:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});