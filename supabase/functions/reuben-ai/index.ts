import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { routeRequest } from "./reuben_engine.ts";
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
    } = await req.json();

    const sessionHistory =
      await getSessionHistory(
        supabase,
        chatId
      );

    const result =
      await routeRequest(
        message,
        {
          chatId,
          userId,
          sessionHistory,
        }
      );

    await saveMessage(
      supabase,
      chatId,
      userId,
      "user",
      message
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