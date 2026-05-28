import { runReubenAI } from "./reuben_engine.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const {
      message,
      userId,
      chatId,
    } = await req.json();

    const result = await runReubenAI({
      message,
      userId,
      chatId,
    });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...cors,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: String(err),
      }),
      {
        status: 500,
        headers: cors,
      }
    );
  }
});