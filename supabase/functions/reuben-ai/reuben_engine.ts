import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";

import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";
import {
  getMemory,
  saveMemory,
  saveFeedback,
  extractLearning
} from "./ai/memory.ts";
/* =========================
   🌐 WEB DETECTOR
========================= */
function needsWeb(message: string) {
  const msg = message.toLowerCase();

  return (
    msg.includes("today") ||
    msg.includes("current") ||
    msg.includes("latest") ||
    msg.includes("news") ||
    msg.includes("who is") ||
    msg.includes("price") ||
    msg.includes("what is")
  );
}

/* =========================
   🎬 RUNWAY DETECTOR
========================= */
function needsRunway(message: string) {
  const msg = message.toLowerCase();

  return (
    msg.includes("image") ||
    msg.includes("picture") ||
    msg.includes("draw") ||
    msg.includes("render") ||
    msg.includes("photo") ||
    msg.includes("generate image") ||
    msg.includes("create image") ||
    msg.includes("make image") ||
    msg.includes("video") ||
    msg.includes("clip")
  );
}

/* =========================
   🔊 ELEVENLABS DETECTOR
========================= */
function needsElevenLabs(message: string) {
  const msg = message.toLowerCase();

  return (
    msg.includes("speak") ||
    msg.includes("voice") ||
    msg.includes("audio") ||
    msg.includes("read") ||
    msg.includes("tts") ||
    msg.includes("elevenlabs")
  );
}

/* =========================
   🧠 SMART ROUTER (NO KEYWORDS DEPENDENCY)
========================= */
async function routeModel(message: string): Promise<"openai" | "groq"> {
  try {
    const decision = await askGroq(`
You are an AI routing engine.

Decide which model should handle this request.

RULES:
- openai → complex reasoning, coding, debugging, architecture, deep explanation, analysis, planning
- groq → simple Q&A, short answers, casual chat, basic info

Return ONLY valid JSON:
{ "model": "openai" | "groq", "confidence": 0-1 }

User message:
${message}
`);

    const parsed = JSON.parse(decision);

    if (parsed?.model === "openai") return "openai";
    return "groq";
  } catch {
    return "groq";
  }
}

/* =========================
   🧹 HISTORY SANITIZER
========================= */
function sanitizeHistory(history: any[]) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(m => m?.content && typeof m.content === "string")
    .slice(-10)
    .map(m => ({
      role: m.role,
      content: m.content,
    }));
}

/* =========================
   🚀 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  let webContext = "";

  try {
    /* =========================
       🌐 WEB SEARCH
    ========================= */
    if (needsWeb(message)) {
      console.log("🌐 Tavily search triggered");

      try {
        const search = await searchTavily(message);

        webContext =
          search?.answer ||
          search?.results?.map((r: any) => r.content).join("\n") ||
          "";
      } catch (err: any) {
        console.warn("Tavily failed:", err.message);
        webContext = "";
      }
    }

    const enrichedMessage = webContext
      ? `
You are ReuNexus AI (Grounded Mode).

STRICT RULES:
- Use ONLY the provided context
- Do NOT use prior knowledge
- Do NOT hallucinate or assume missing facts
- If context is insufficient, say: "not found in sources"
- If asked about who made you always say; Reuben Murimi,be creative,confidence and detailed
- Always think intelligently and respond confidently

CONTEXT:
${webContext}

QUESTION:
${message}
`
      : message;

    /* =========================
       🎬 RUNWAY (IMAGE/VIDEO)
    ========================= */
    if (needsRunway(message)) {
      console.log("🎬 Runway triggered");

      try {
        const imageResult = await generateImage(message);

        const finalUrl =
          typeof imageResult === "string"
            ? imageResult
            : imageResult?.output_url ||
              imageResult?.url ||
              imageResult?.payload ||
              (Array.isArray(imageResult?.output) ? imageResult.output[0] : null) ||
              (Array.isArray(imageResult?.result) ? imageResult.result[0] : null);

        if (!finalUrl || typeof finalUrl !== "string") {
          throw new Error("No valid image URL returned from Runway");
        }

        return {
          type: "image",
          payload: finalUrl,
          webUsed: false,
          mode: "runway",
        };
      } catch (err: any) {
        console.warn("Runway failed:", err.message);

        return {
          type: "text",
          payload: "Image generation failed.",
          webUsed: false,
          mode: "runway-error",
        };
      }
    }

    /* =========================
       🔊 ELEVENLABS
    ========================= */
    if (needsElevenLabs(message)) {
      console.log("🔊 ElevenLabs triggered");

      try {
        const audioUrl = await generateSpeech(message);

        return {
          type: "audio",
          payload: audioUrl,
          webUsed: false,
          mode: "elevenlabs",
        };
      } catch (err: any) {
        console.warn("ElevenLabs failed:", err.message);

        return {
          type: "text",
          payload: "Audio generation failed.",
          webUsed: false,
          mode: "elevenlabs-error",
        };
      }
    }

    /* =========================
       🧠 SMART MODEL ROUTING
    ========================= */
    const model = await routeModel(message);

    let result = "";

try {
  if (model === "openai") {
    console.log("🧠 OpenAI Brain");
    result = await askOpenAI(enrichedMessage, history);
  } else {
    console.log("⚡ Groq Brain");
    result = await askGroq(enrichedMessage, history);
  }
} catch (primaryError) {
  console.warn("Primary brain failed.");

  try {
    if (model === "openai") {
      console.log("⚡ Fallback -> Groq");
      result = await askGroq(enrichedMessage, history);
    } else {
      console.log("🧠 Fallback -> OpenAI");
      result = await askOpenAI(enrichedMessage, history);
    }
  } catch (secondaryError) {
    console.warn("Secondary brain failed.");

    try {
      console.log("🦙 Final Fallback -> Ollama");
      result = await askOllama(enrichedMessage, history);
    } catch (ollamaError) {
      console.error("All models failed.");

      result =
        "All AI models are currently unavailable. Please try again later.";
    }
  }
}

    return {
      type: "text",
      payload: result || "No response generated.",
      webUsed: !!webContext,
      mode: webContext ? "grounded" : "llm",
    };

  } catch (err: any) {
    console.error("routeRequest fatal error:", err);

    return {
      type: "text",
      payload: "System error in ReuNexus AI.",
      webUsed: false,
      mode: "error",
    };
  }
} 