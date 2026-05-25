export async function getAIStream({ message }) {
  const res = await fetch(
    "https://whvzdutfyydshamwfhvu.supabase.co/functions/v1/reuben-ai-stream",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!res.body) throw new Error("No stream response");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  return {
    async *[Symbol.asyncIterator]() {
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullText += chunk;

        yield fullText;
      }
    },
  };
}