import { runReubenAI } from "./reuben_engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

Deno.serve(async (req) => {
  // =========================
  // HANDLE PRE-FLIGHT (CRITICAL)
  // =========================
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // OPTIONAL: allow GET test
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "reuben-ai alive" }),
      { headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();

    const { message, userId, chatId } = body;

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
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});