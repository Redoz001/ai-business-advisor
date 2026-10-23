import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkUserLimit, consumeUserRequest } from "../reuben-ai/billing.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "Sign in to edit an image." }, 401);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData.user;
    if (authError || !user) return jsonResponse({ error: "Your session has expired. Sign in again." }, 401);

    const body = await request.json();
    const sourcePath = typeof body?.sourcePath === "string" ? body.sourcePath : "";
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (
      !sourcePath.startsWith(`${user.id}/`) ||
      sourcePath.includes("..") ||
      !prompt ||
      prompt.length > 4000
    ) {
      return jsonResponse({ error: "Provide your uploaded image and a valid edit description." }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "Image editing is not configured on this project yet." }, 503);

    if (!(await checkUserLimit(user.id))) {
      return jsonResponse({ error: "Your AI request limit has been reached." }, 429);
    }
    if (!(await consumeUserRequest(user.id))) {
      return jsonResponse({ error: "Your AI request limit has been reached." }, 429);
    }

    const { data: source, error: sourceError } = await supabase.storage
      .from("visual-assets")
      .download(sourcePath);
    if (sourceError || !source) return jsonResponse({ error: "The uploaded image could not be found." }, 404);
    if (source.size > 20 * 1024 * 1024) {
      return jsonResponse({ error: "Image edits are limited to source files under 20 MB." }, 413);
    }

    const mimeType = source.type.toLowerCase();
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      return jsonResponse({ error: "Upload a PNG, JPEG, or WebP image for AI editing." }, 415);
    }

    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("image", new File([source], `source.${extension}`, { type: mimeType }));

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI image edit failed:", result?.error?.message || response.status);
      return jsonResponse({ error: result?.error?.message || "The image edit could not be completed." }, 502);
    }

    const imageBase64 = result?.data?.[0]?.b64_json;
    if (typeof imageBase64 !== "string" || !imageBase64) {
      return jsonResponse({ error: "The image provider returned no edited image." }, 502);
    }

    return jsonResponse({ imageBase64, mimeType: "image/png" });
  } catch (error) {
    console.error("Media edit request failed:", error);
    return jsonResponse({ error: "The image edit failed. Please try again." }, 500);
  }
});