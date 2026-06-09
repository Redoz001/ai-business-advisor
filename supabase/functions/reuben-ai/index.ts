import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { routeRequest } from "./reuben_engine.ts";

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
    const { message, chatId, userId } = await req.json();

    const result = await routeRequest(message, {
      chatId,
      userId,
    });

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        type: "error",
        payload: err.message,
      }),
      { status: 500 }
    );
  }
});