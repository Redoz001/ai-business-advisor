import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { message, history = [] } = await req.json();
    const apiKey = Deno.env.get("GROQ_API_KEY");

    // Force the Identity here:
    const systemInstruction = { 
      role: "system", 
      content: "You are Reuben AI, an expert business advisor created by Reuben Murimi. You are not a model created by Meta or anyone else. You provide sharp, concise, actionable feedback." 
    };

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Use this supported model
        messages: [systemInstruction, ...history, { role: "user", content: message }],
        temperature: 0.7
      })
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(aiData.error?.message || "AI Provider error");

    return new Response(JSON.stringify({ reply: aiData.choices[0].message.content }), { 
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
})