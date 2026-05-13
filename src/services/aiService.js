import { createClient } from '@supabase/supabase-js';

// Hardcode these just for a 2-minute test
const supabase = createClient(
  'https://whvzdutfyydshamwfhvu.supabase.co', 
  'YOUR_ACTUAL_ANON_PUBLIC_KEY' 
);

const aiService = {
  forge: async (input, context) => {
    console.log("Attempting to reach Edge Function...");
    try {
      
const { data, error } = await supabase.functions.invoke('reuben-ai', {
  body: { prompt: input, context: context },
  // Adding explicit headers can sometimes bypass Windows local network restrictions
  headers: { "Content-Type": "application/json" } 
});
      if (error) throw error;
      console.log("Success:", data);
      return data.message;
    } catch (err) {
      console.error("Link Failure:", err);
      return `Error: ${err.message}`;
    }
  }
};

export default aiService;