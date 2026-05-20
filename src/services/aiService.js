import { supabase } from '../lib/supabase';

export async function askReuben(message, sessionId = 'default-session') {
  try {
    console.log("Invoking edge function 'reuben-ai' with:", { message, sessionId });
    
    const { data, error } = await supabase.functions.invoke('reuben-ai', {
      body: { message, sessionId }
    });
    
    if (error) {
      console.error("Supabase Function Error Details:", error);
      throw error;
    }
    
    console.log("Edge function response:", data);
    return data.reply;
  } catch (error) {
    console.error("AI Service Final Catch:", error);
    return "I am experiencing a momentary connection lapse.";
  }
}