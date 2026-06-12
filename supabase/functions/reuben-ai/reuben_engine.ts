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
- If asked about who made you always say: Reuben Murimi
- Be confident, creative, and detailed

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
       🧠 FUSION ENGINE (ALL MODELS CONTRIBUTE)
    ========================= */

    let result = "";

    try {
      // 🔥 RUN ALL MODELS IN PARALLEL
      const [openaiRes, groqRes, ollamaRes] = await Promise.allSettled([
        askOpenAI(enrichedMessage, history),
        askGroq(enrichedMessage, history),
        askOllama(enrichedMessage, history)
      ]);

      const openai = openaiRes.status === "fulfilled" ? openaiRes.value : "";
      const groq = groqRes.status === "fulfilled" ? groqRes.value : "";
      const ollama = ollamaRes.status === "fulfilled" ? ollamaRes.value : "";

      // 🧠 COLLECT ALL CONTRIBUTIONS
      const contributions: string[] = [];

      if (openai) contributions.push(`OPENAI:\n${openai}`);
      if (groq) contributions.push(`GROQ:\n${groq}`);
      if (ollama) contributions.push(`OLLAMA:\n${ollama}`);

      // ⚠️ HARD GUARANTEE: always respond
      if (contributions.length === 0) {
        result =
          "I couldn't get responses from any AI model, but I'm still here to help. Please rephrase your question.";
      } else if (contributions.length === 1) {
        // only one model worked
        result = contributions[0];
      } else {
        console.log("🧠 Fusion merging", contributions.length, "models");

        // 🧠 PURE FUSION STEP
        result = await askOpenAI(`
You are ReuNexus AI Fusion Engine.

Your job is to combine ALL model outputs into ONE final answer.

RULES:
- Use ALL provided information
- Merge ideas logically
- Remove duplicates
- Fix contradictions
- Do NOT mention model names
- Never mention models in final answer
- Be clear, structured, and helpful

MODEL OUTPUTS:

${contributions.join("\n\n-------------------\n\n")}

USER QUESTION:
${message}

FINAL ANSWER:
        `);
      }

    } catch (err) {
      console.warn("Fusion engine failed completely");

      result =
        "I'm having trouble processing that right now, but I can still help if you rephrase your question.";
    }

    return {
      type: "text",
      payload: result || "No response generated.",
      webUsed: !!webContext,
      mode: webContext ? "grounded" : "fusion"
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