// src/services/aiService.js

import { supabase } from "../lib/supabase";

export async function sendMessageToAI({
  message,
  userId,
  chatId,
}) {
  try {
    const payload = {
      message,
      userId,
      chatId: chatId ?? null,
    };

    console.log("Sending AI Payload:", payload);

    const { data, error } =
      await supabase.functions.invoke(
        "reuben-ai",
        {
          body: payload,
        }
      );

    // Network / invoke errors
    if (error) {
      console.error(
        "SUPABASE_FUNCTION_ERROR:",
        error
      );

      throw new Error(
        error.message ||
          "Failed to invoke Edge Function"
      );
    }

    // Missing response
    if (!data) {
      throw new Error(
        "No response from AI service."
      );
    }

    // Backend returned structured failure
    if (data.success === false) {
      throw new Error(
        data.error || "AI request failed."
      );
    }

    return data;
  } catch (err) {
    console.error(
      "FRONTEND_FETCH_ERROR:",
      err
    );

    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : String(err),
      reply:
        "Error: " +
        (err instanceof Error
          ? err.message
          : String(err)),
    };
  }
}