import { supabase } from '../lib/supabase.js';

export const askReuben = async (message, userId) => {

  const { data, error } = await supabase.functions.invoke('reuben-ai', {
    body: {
      message,
      userId
    }
  });

  if (error) {
    console.error(error);
    return "Error connecting to AI";
  }

  return data?.reply;
};