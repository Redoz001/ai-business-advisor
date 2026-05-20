Deno.serve(async (req) => {
  // CORS Headers for frontend connection
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = body?.message;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid 'message'",
          expected: { message: "string" },
          received: body,
        }),
        { status: 400, headers }
      );
    }

    // Grab your Groq API key securely from your Supabase vault secrets
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is missing from server environment secrets.");
    }
    
    // Call the live production Groq Llama 3.1 model cluster
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: 'You are Reuben AI, an elite, highly intelligent executive assistant and autonomous core built by Reuben Murimi. Speak with total confidence, technical precision, and absolute clarity.' 
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API responded with error status ${groqResponse.status}: ${errorText}`);
    }

    const groqData = await groqResponse.json();
    const reply = groqData.choices[0]?.message?.content || "System Core received an empty response matrix.";

    return new Response(
      JSON.stringify({
        reply,
        status: "success",
      }),
      { status: 200, headers }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Server processing exception",
        details: String(err.message || err),
      }),
      { status: 500, headers }
    );
  }
});