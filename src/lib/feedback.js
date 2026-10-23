import { supabase } from "./supabase.js";

export async function saveFeedback({
  id,
  userId,
  chatId = null,
  messageId = null,
  source,
  rating = null,
  feedback = "",
}) {
  if (!userId) {
    throw new Error("Sign in to send feedback.");
  }

  const values = {
    user_id: userId,
    chat_id: chatId,
    message_id: messageId,
    source,
    rating,
    feedback: feedback.trim(),
  };

  if (id) {
    const { error } = await supabase
      .from("ai_feedback")
      .update({ rating, feedback: values.feedback })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("ai_feedback")
      .insert(values)
      .select("id")
      .single();

    if (error) throw error;
    id = data.id;
  }

  // Notification email is fire-and-forget: feedback is already saved.
  // Never let a notification failure surface as a user-facing error.
  try {
    const { error } = await supabase.functions.invoke("feedback-notification", {
      body: { feedbackId: id },
    });

    if (error) {
      console.warn(
        "Feedback notification failed (feedback was still saved):",
        error,
      );
    }
  } catch (notificationError) {
    console.warn(
      "Feedback notification threw (feedback was still saved):",
      notificationError,
    );
  }

  return id;
}
