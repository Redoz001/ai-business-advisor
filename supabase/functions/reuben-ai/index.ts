import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { message, chatId } = await req.json();

    // Get chat history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", chatId)
      .order("created_at", { ascending: true })
      .limit(20);

    const context = (history || [])
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    // AI CALL
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "You are ReubenAI, a production SaaS assistant.",
            },
            {
              role: "user",
              content: `${context}\n\nUser: ${message}`,
            },
          ],
        }),
      }
    );

    const data = await res.json();

    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "No response";

    return new Response(
      JSON.stringify({ reply }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
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