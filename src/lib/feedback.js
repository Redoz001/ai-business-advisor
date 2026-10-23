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

  try {
    const { error } = await supabase.functions.invoke("feedback-notification", {
      body: { feedbackId: id },
    });

    if (error) throw error;
  } catch (notificationError) {
    const errorWithId = new Error(
      `Feedback was saved, but the notification email could not be sent: ${
        notificationError instanceof Error
          ? notificationError.message
          : "Unexpected error"
      }`,
    );
    errorWithId.feedbackId = id;
    throw errorWithId;
  }

  return id;
}
