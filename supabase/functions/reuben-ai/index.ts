import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { routeRequest } from "./reuben_engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* =========================
   🧠 INTENT DETECTION (IMPROVED)
========================= */
function detectIntent(message: string) {
  const m = message.toLowerCase();

  const image =
    /\b(generate|create|make|draw|render).*(image|picture|photo|art)\b/.test(m);

  const voice =
    /\b(speak|voice|audio|read|tts)\b/.test(m);

  const web =
    /\b(today|latest|news|current|who is|price|what is)\b/.test(m);

  return { image, voice, web };
}

/* =========================
   🧹 SAFE PARSER
========================= */
function safeJSON(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const raw = await req.text();

    if (!raw) {
      return new Response(
        JSON.stringify({ success: false, error: "Empty request body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const body = safeJSON(raw);

    if (!body) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    let { message, context } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "message is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // =========================
    // 🧹 NORMALIZATION LAYER
    // =========================
    message = message.trim().slice(0, 4000);

    context = context || { sessionHistory: [] };

    const { image } = detectIntent(message);

    // =========================
    // 🚀 IMAGE FAST PATH (ASYNC)
    // =========================
    if (image) {
      // DO NOT await — allow background processing
      routeRequest(message, context).catch((err) => {
        console.error("Image pipeline failed:", err);
      });

      return new Response(
        JSON.stringify({
          success: true,
          type: "image",
          payload: "processing",
          mode: "runway-async",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // =========================
    // 🚀 MAIN PIPELINE
    // =========================
    const result = await routeRequest(message, context);

    return new Response(
      JSON.stringify({
        success: true,
        type: result.type || "text",
        payload: result.payload ?? "",
        webUsed: result.webUsed ?? false,
        mode: result.mode ?? "llm",
        mediaType: result.type || "text",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("Edge Function Error:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});