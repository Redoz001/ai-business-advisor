import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { routeRequest, streamRequest } from "./reuben_engine.ts";
import {
  getSessionHistory,
  saveMessage,
} from "./ai/messages.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const {
      message,
      chatId,
      userId,
      stream,
    } = await req.json();

    const sessionHistory =
      await getSessionHistory(
        supabase,
        chatId
      );

    // Streaming mode returns a single assistant message as SSE deltas.
    // Saving the user message first keeps history correct even if the
    // client disappears mid-stream.
    await saveMessage(
      supabase,
      chatId,
      userId,
      "user",
      message
    );

    if (stream === true) {
      const body = new ReadableStream({
        async start(controller) {
          let full = "";

          try {
            for await (const delta of streamRequest(message, {
              chatId,
              userId,
              sessionHistory,
            })) {
              if (!delta) continue;
              full += delta;
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ delta })}\n\n`
                )
              );
            }
          } catch (streamError: any) {
            console.error("SSE stream error:", streamError.message);
            if (!full) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ error: streamError.message || "Stream error" })}\n\n`
                )
              );
            }
          }

          if (full) {
            await saveMessage(
              supabase,
              chatId,
              userId,
              "assistant",
              full
            );
          }

          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
          controller.close();
        },
        cancel() {
          console.log("SSE stream cancelled by client");
        },
      });

      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const result =
      await routeRequest(
        message,
        {
          chatId,
          userId,
          sessionHistory,
        }
      );

    if (
      result?.type === "text" &&
      result?.payload
    ) {
      await saveMessage(
        supabase,
        chatId,
        userId,
        "assistant",
        result.payload
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          "Content-Type":
            "application/json",
          "Access-Control-Allow-Origin":
            "*",
        },
      }
    );
  } catch (err: any) {
    console.error(err);

    return new Response(
      JSON.stringify({
        type: "error",
        payload:
          err.message ||
          "Internal server error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",
          "Access-Control-Allow-Origin":
            "*",
        },
      }
    );
  }
});