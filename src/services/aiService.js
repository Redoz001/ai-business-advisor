import { supabase } from "../lib/supabase";

export async function sendMessageToAI({
  message,
  userId,
  chatId,
}) {
  const { data, error } =
    await supabase.functions.invoke(
      "reuben-ai",
      {
        body: {
          message,
          userId,
          chatId,
        },
      }
    );

  if (error) throw error;

  return data;
}