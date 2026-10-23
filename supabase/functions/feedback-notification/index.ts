const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return jsonResponse({ error: "Sign in to send feedback." }, 401);
    }

    const { feedbackId } = await req.json();
    if (
      typeof feedbackId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(feedbackId)
    ) {
      return jsonResponse({ error: "Invalid feedback reference." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("FEEDBACK_FROM_EMAIL");
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
      console.error("Feedback email notification is not fully configured.");
      return jsonResponse({
        error:
          "Feedback email is not configured. Set RESEND_API_KEY and FEEDBACK_FROM_EMAIL in Supabase secrets.",
      }, 503);
    }

    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(
      accessToken,
    );
    if (authError || !authData.user) {
      return jsonResponse({ error: "Your session is invalid. Please sign in again." }, 401);
    }

    const { data: feedback, error: feedbackError } = await supabase
      .from("ai_feedback")
      .select("source, rating, feedback, chat_id, message_id, created_at")
      .eq("id", feedbackId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (feedbackError) {
      console.error("Could not load saved feedback:", feedbackError.message);
      throw new Error("Could not load the saved feedback.");
    }
    if (!feedback) {
      return jsonResponse({ error: "Feedback was not found." }, 404);
    }

    const details = [
      `From: ${authData.user.email ?? "Unknown account"}`,
      `Type: ${feedback.source}`,
      `Rating: ${feedback.rating ?? "Not provided"}`,
      `Chat ID: ${feedback.chat_id ?? "Not provided"}`,
      `Message ID: ${feedback.message_id ?? "Not provided"}`,
      `Submitted: ${feedback.created_at}`,
      "",
      "Feedback:",
      feedback.feedback || "(No written feedback)",
    ].join("\n");

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ["redozmuriz81@gmail.com"],
        subject: `ReuNexus feedback: ${feedback.source}`,
        text: details,
      }),
    });

    if (!emailResponse.ok) {
      const responseBody = await emailResponse.text();
      console.error("Feedback email provider rejected notification:", {
        status: emailResponse.status,
        body: responseBody.slice(0, 1000),
      });
      throw new Error("The email provider rejected the notification.");
    }

    return jsonResponse({ message: "Feedback email sent." });
  } catch (error) {
    console.error(
      "Feedback email notification failed:",
      error instanceof Error ? error.message : "Unexpected error",
    );
    return jsonResponse({
      error: error instanceof Error
        ? error.message
        : "Could not send feedback notification.",
    }, 500);
  }
});
