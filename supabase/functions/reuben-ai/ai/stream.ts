import { corsHeaders } from "../utils/cors.ts";

export function streamResponse(res: Response) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const text = line.replace("data: ", "").trim();
            if (!text || text === "[DONE]") continue;

            // ✅ FIX SPACING ISSUE
            const cleaned = text
              .replace(/\s+/g, " ")
              .replace(/([a-z])([A-Z])/g, "$1 $2");

            controller.enqueue(
              encoder.encode(`data: ${cleaned}\n\n`)
            );
          }
        }

        controller.close();
      },
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
}