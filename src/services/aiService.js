import { supabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/reuben-ai`;

export async function sendMessageToAI({ message, userId, chatId }) {
  try {
    // =========================
    // VALIDATE ENV VARS
    // =========================
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    // =========================
    // GET SESSION
    // =========================
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const session = data.session;

    if (!session) {
      throw new Error("User not authenticated");
    }

    // =========================
    // CALL EDGE FUNCTION
    // =========================
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        message,
        userId,
        chatId,
      }),
    });

    // =========================
    // HANDLE HTTP ERRORS
    // =========================
    if (!response.ok) {
      let errorMessage = "AI request failed";

      try {
        const errorData = await response.json();
        errorMessage =
          errorData?.error ||
          errorData?.message ||
          errorMessage;
      } catch {
        // ignore JSON parse failure
      }

      throw new Error(errorMessage);
    }

    // =========================
    // PARSE RESPONSE
    // =========================
    const dataResponse = await response.json();

    return {
      success: true,
      ...dataResponse,
    };

  } catch (err) {
    console.error("AI SERVICE ERROR:", err);

    // IMPORTANT: ensures UI always handles failure cleanly
    return {
      success: false,
      error: err?.message || "Unable to contact ReubenAI",
    };
  }
}