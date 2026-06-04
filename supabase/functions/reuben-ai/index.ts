import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { routeRequest } from "./reuben_engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const raw = await req.text();
    if (!raw) throw new Error("Empty request body");

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error("Invalid JSON body");
    }

    const { message, context } = body;

    if (!message) throw new Error("message is required");

    // =========================
    // 🚀 FIX: NON-BLOCKING IMAGE SAFETY LAYER
    // =========================
    const isImageRequest =
      message.toLowerCase().includes("image") ||
      message.toLowerCase().includes("picture") ||
      message.toLowerCase().includes("draw") ||
      message.toLowerCase().includes("generate image") ||
      message.toLowerCase().includes("create image") ||
      message.toLowerCase().includes("make image");

    if (isImageRequest) {
      // 🔥 IMPORTANT: return immediately to prevent Edge timeout
      routeRequest(message, context || { sessionHistory: [] })
        .catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          type: "image",
          payload: "processing",
          webUsed: false,
          mode: "runway-async"
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
    // NORMAL FLOW (UNCHANGED)
    // =========================
    const result = await routeRequest(
      message,
      context || { sessionHistory: [] }
    );

    return new Response(
      JSON.stringify({
        success: true,
        type: result.type || "text",
        payload: result.payload || "",
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
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      {
        status: 400,
        headers: corsHeaders,
      }
    );
  }
});