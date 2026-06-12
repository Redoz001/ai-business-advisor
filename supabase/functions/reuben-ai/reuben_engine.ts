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
   🧠 SAFE CONTRIBUTOR FILTER
========================= */
function isValidContribution(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.trim().toLowerCase();

  if (t.length < 3) return false;

  // 🚨 filter API / quota / failure noise
  if (t.includes("error")) return false;
  if (t.includes("rate limit")) return false;
  if (t.includes("quota")) return false;
  if (t.includes("failed")) return false;
  if (t.includes("unauthorized")) return false;
  if (t.includes("invalid api")) return false;

  return true;
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
      try {
        const search = await searchTavily(message);

        webContext =
          search?.answer ||
          search?.results?.map((r: any) => r.content).join("\n") ||
          "";
      } catch {
        webContext = "";
      }
    }

    const enrichedMessage = webContext
      ? `
CONTEXT:
${webContext}

QUESTION:
${message}
`
      : message;

    /* =========================
       🎬 IMAGE / VIDEO
    ========================= */
    if (needsRunway(message)) {
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

        if (!finalUrl) throw new Error();

        return {
          type: "image",
          payload: finalUrl,
          webUsed: false,
          mode: "runway",
        };
      } catch {
        return {
          type: "text",
          payload: "Image generation failed.",
          webUsed: false,
          mode: "error",
        };
      }
    }

    /* =========================
       🔊 TTS
    ========================= */
    if (needsElevenLabs(message)) {
      try {
        const audioUrl = await generateSpeech(message);

        return {
          type: "audio",
          payload: audioUrl,
          webUsed: false,
          mode: "elevenlabs",
        };
      } catch {
        return {
          type: "text",
          payload: "Audio generation failed.",
          webUsed: false,
          mode: "error",
        };
      }
    }

    /* =========================
       🧠 MULTI-MODEL FUSION
    ========================= */

    const contributorPrompt = `
You are NOT an assistant.

You are a reasoning contributor.

RULES:
- NO greetings
- NO assistant identity
- ONLY reasoning, facts, insights
- NO final answer

User question:
${enrichedMessage}
`;

    const [openaiRes, groqRes, ollamaRes] = await Promise.allSettled([
      askOpenAI(contributorPrompt, history),
      askGroq(contributorPrompt, history),
      askOllama(contributorPrompt, history),
    ]);

    const openai =
      openaiRes.status === "fulfilled" && isValidContribution(openaiRes.value)
        ? openaiRes.value
        : "";

    const groq =
      groqRes.status === "fulfilled" && isValidContribution(groqRes.value)
        ? groqRes.value
        : "";

    const ollama =
      ollamaRes.status === "fulfilled" && isValidContribution(ollamaRes.value)
        ? ollamaRes.value
        : "";

    const signals: string[] = [];

    if (openai) signals.push(`OPENAI:\n${openai}`);
    if (groq) signals.push(`GROQ:\n${groq}`);
    if (ollama) signals.push(`OLLAMA:\n${ollama}`);

    let result = "";

    if (signals.length === 0) {
      result =
        "I couldn't get responses from AI models right now. Please try again.";
    } else {
      result = await askOpenAI(`
You are a Fusion Engine.

Merge all reasoning signals into ONE clear answer.

RULES:
- Combine ideas
- Remove duplicates
- Resolve contradictions
- Ignore errors or noise
- Do NOT mention models

SIGNALS:
${signals.join("\n\n---\n\n")}

QUESTION:
${message}

FINAL ANSWER:
`);
    }

    return {
      type: "text",
      payload: result,
      webUsed: !!webContext,
      mode: "fusion",
    };

  } catch (err) {
    return {
      type: "text",
      payload: "System error in ReuNexus AI.",
      webUsed: false,
      mode: "error",
    };
  }
}