import { supabase } from "../lib/supabase";

const FUNCTION_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`;

export async function sendMessageToAI({
  message,
  userId,
  chatId,
}) {
  try {
    // Get current auth session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("User not authenticated");
    }

    // Send request to Supabase Edge Function
    const response = await fetch(FUNCTION_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${session.access_token}`,

        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },

      body: JSON.stringify({
        message,
        userId,
        chatId,
      }),
    });

    // Handle failed responses
    if (!response.ok) {
      let errorMessage = "AI request failed";

      try {
        const errorData = await response.json();

        errorMessage =
          errorData?.error ||
          errorData?.message ||
          errorMessage;

      } catch {
        // Ignore JSON parse errors
      }

      throw new Error(errorMessage);
    }

    // Parse successful response
    const data = await response.json();

    return data;

  } catch (err) {
    console.error("AI SERVICE ERROR:", err);

    return {
      success: false,
      error:
        err?.message ||
        "Unable to contact ReubenAI",
    };
  }
}