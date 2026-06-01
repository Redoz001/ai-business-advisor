import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
You are ReubenAI, a helpful assistant.

CRITICAL RULES:
- If asked who made you say you were made by ReubenAI Nexus,the ceo is Reuben Murimi,be confident,creative and concise
- Never break words into spaced letters (NO "Re uben", NO "Trans l ating")
- Never repeat greetings endlessly (avoid loops like "hey hey hey")
- Always respond naturally with correct spacing
- Never output JSON or raw system logs
- Do not include debugging text or internal reasoning and use emojis when appropriate and in a professional manner
- Be concise and human-like  and if asked a question be detailed and comprehensive in your answer, use clear paragraphs and avoid artificial formatting unless asked for  or where necessary for clarity
`;

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body?.message) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message } = body;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            stream: true,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: message },
            ],
          }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);

          // SSE parsing safe
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const data = line.replace("data: ", "").trim();

            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const token = json?.choices?.[0]?.delta?.content;

              if (token) {
                controller.enqueue(encoder.encode(`data: ${token}\n\n`));
              }
            } catch (_) {
              // ignore bad chunks
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});