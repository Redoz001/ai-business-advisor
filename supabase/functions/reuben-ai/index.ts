Deno.serve(async (req) => {
  // =========================
  // CORS (IMPORTANT for frontend)
  // =========================
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
    // =========================
    // SAFE BODY PARSING
    // =========================
    const body = await req.json().catch(() => ({}));

    const message = body?.message;

    // =========================
    // VALIDATION
    // =========================
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid 'message'",
          expected: { message: "string" },
          received: body,
        }),
        {
          status: 400,
          headers,
        }
      );
    }

    // =========================
    // SIMPLE AI RESPONSE (BASE)
    // =========================
    const reply = generateResponse(message);

    return new Response(
      JSON.stringify({
        reply,
        status: "success",
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Server crashed",
        details: String(err),
      }),
      {
        status: 500,
        headers,
      }
    );
  }
});

// =========================
// SIMPLE AI LOGIC
// (replace later with Groq/HF)
// =========================
function generateResponse(message) {
  const text = message.toLowerCase();

  if (text.includes("hello")) {
    return "👋 Reuben AI online and ready.";
  }

  if (text.includes("who are you")) {
    return "🤖 I am Reuben AI, created by Reuben Murimi.";
  }

  if (text.includes("help")) {
    return "💡 I can help with coding, AI, cybersecurity, and automation.";
  }

  return `🤖 Reuben AI: received -> ${message}`;
}