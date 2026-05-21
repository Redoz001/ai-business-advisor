import { supabase } from '../lib/supabase.js';

export const askReuben = async (message, userId, history = []) => {
  // Hardcoded test payload
  const payload = {
    message: "Hello, are you working?",
    userId: "test-user",
    history: []
  };

  console.log("Sending payload to function:", payload);

  const { data, error } = await supabase.functions.invoke('reuben-ai', {
    body: payload
  });

  if (error) {
    console.error("Invocation failed:", error);
    throw error;
  }
  
  console.log("Success! Response:", data);
  return data.reply;
};