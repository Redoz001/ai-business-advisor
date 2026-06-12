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
   🌐 DETECTORS
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
   🧹 HISTORY
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
   🧠 VALIDATION
========================= */
function isValid(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase().trim();

  if (t.length < 3) return false;
  if (t.includes("error")) return false;
  if (t.includes("quota")) return false;
  if (t.includes("rate limit")) return false;
  if (t.includes("failed")) return false;
  if (t.includes("unauthorized")) return false;

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
       🌐 WEB
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
       🎬 IMAGE
    ========================= */
    if (needsRunway(message)) {
      try {
        const img = await generateImage(message);

        const url =
          typeof img === "string"
            ? img
            : img?.output_url ||
              img?.url ||
              img?.payload ||
              (Array.isArray(img?.output) ? img.output[0] : null);

        if (!url) throw new Error();

        return {
          type: "image",
          payload: url,
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
        const audio = await generateSpeech(message);

        return {
          type: "audio",
          payload: audio,
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
       🧠 CONTRIBUTOR PROMPT
    ========================= */
    const contributorPrompt = `
You are NOT an assistant.
You are a reasoning contributor only.

RULES:
- NO greetings
- NO identity
- ONLY insights, reasoning, facts
- NO final answer

User:
${enrichedMessage}
`;

    /* =========================
       🧠 PARALLEL MODELS
    ========================= */
    const [openaiRes, groqRes, ollamaRes] = await Promise.allSettled([
      askOpenAI(contributorPrompt, history),
      askGroq(contributorPrompt, history),
      askOllama(contributorPrompt, history),
    ]);

    const openai =
      openaiRes.status === "fulfilled" && isValid(openaiRes.value)
        ? openaiRes.value
        : "";

    const groq =
      groqRes.status === "fulfilled" && isValid(groqRes.value)
        ? groqRes.value
        : "";

    const ollama =
      ollamaRes.status === "fulfilled" && isValid(ollamaRes.value)
        ? ollamaRes.value
        : "";

    const signals: string[] = [];

    if (openai) signals.push(`OPENAI:\n${openai}`);
    if (groq) signals.push(`GROQ:\n${groq}`);
    if (ollama) signals.push(`OLLAMA:\n${ollama}`);

    /* =========================
       🧠 SAFE FUSION ENGINE (FIXED)
    ========================= */

    let result = "";

    const fusionPrompt = `
You are a Fusion Engine.

Combine reasoning signals into ONE answer.

RULES:
- merge ideas
- remove repetition
- ignore errors or noise
- do NOT mention models

SIGNALS:
${signals.join("\n\n---\n\n")}

QUESTION:
${message}

FINAL ANSWER:
`;

    // 🔥 CRITICAL: fallback chain prevents quota crash
    try {
      result = await askOpenAI(fusionPrompt, history);
    } catch (e1) {
      console.warn("OpenAI fusion failed → fallback Groq");

      try {
        result = await askGroq(fusionPrompt, history);
      } catch (e2) {
        console.warn("Groq fusion failed → fallback Ollama");

        try {
          result = await askOllama(fusionPrompt, history);
        } catch (e3) {
          console.warn("All fusion models failed");

          result =
            "All AI models are currently unavailable. Please try again.";
        }
      }
    }

    /* =========================
       🧠 FINAL SAFETY
    ========================= */
    if (!isValid(result)) {
      result =
        "I couldn't generate a valid response. Please try rephrasing your question.";
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