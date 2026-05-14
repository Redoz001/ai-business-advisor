import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://whvzdutfyydshamwfhvu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodnpkdXRmeXlkc2hhbXdmaHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjQ5MDAsImV4cCI6MjA5NDE0MDkwMH0.KEVgU3l-d9glmFf0n4oO3nOnLnvbxTu98gdwh3hyWmo'
);

const aiService = {

  forge: async (input, context) => {

    console.log("Attempting to reach Edge Function...");

    try {

      const { data, error } = await supabase.functions.invoke(
        'reuben-ai',
        {
          body: {
            prompt: input,
            context: context
          }
        }
      );

      console.log("RAW RESPONSE:", data);

      if (error) {
        console.error("SUPABASE ERROR:", error);
        throw error;
      }

      // Safe fallback handling
      if (!data) {
        return "No response received.";
      }

      // If edge function returns message
      if (data.message) {
        return data.message;
      }

      // If edge function returns generic object
      return JSON.stringify(data, null, 2);

    } catch (err) {

      console.error("Link Failure:", err);

      return `Error: ${err.message}`;
    }
  }
};

export default aiService;