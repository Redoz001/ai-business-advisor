import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";

import { searchTavily } from "./providers/tavily.ts";
import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";

/* =========================
   🧹 HISTORY SANITIZER
========================= */
function sanitizeHistory(history: any[]) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(m => m?.content && typeof m.content === "string")
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));
}

/* =========================
   🚨 RESPONSE VALIDATOR
========================= */
function isValid(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase().trim();

  return (
    t.length > 3 &&
    !t.includes("error") &&
    !t.includes("quota") &&
    !t.includes("rate limit") &&
    !t.includes("failed") &&
    !t.includes("unauthorized") &&
    !t.includes("insufficient")
  );
}

/* =========================
   🌐 WEB DETECTION
========================= */
function needsWeb(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("today") ||
    m.includes("latest") ||
    m.includes("news") ||
    m.includes("who is") ||
    m.includes("price") ||
    m.includes("what is")
  );
}

/* =========================
   🎬 IMAGE DETECTION
========================= */
function needsImage(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("image") ||
    m.includes("picture") ||
    m.includes("draw") ||
    m.includes("render") ||
    m.includes("photo")
  );
}

/* =========================
   🔊 TTS DETECTION
========================= */
function needsTTS(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("speak") ||
    m.includes("voice") ||
    m.includes("audio") ||
    m.includes("read")
  );
}

/* =========================
   🧠 MODEL CALL WRAPPER (SAFE)
========================= */
async function safeCall(fn: Function, input: string, history: any[]) {
  try {
    const res = await fn(input, history);
    return isValid(res) ? res : null;
  } catch {
    return null;
  }
}

/* =========================
   🧠 CONTRIBUTOR PROMPT
========================= */
function contributorPrompt(input: string) {
  return `
You are a reasoning contributor.

RULES:
- Do NOT introduce yourself
- Only provide useful reasoning
- No greetings
- No refusal unless unsafe

TASK:
${input}
`;
}

/* =========================
   🧠 FUSION PROMPT
========================= */
function fusionPrompt(signals: string[], question: string) {
  return `
You are a professional AI fusion engine.

TASK:
Merge all reasoning into ONE high-quality answer.

RULES:
- remove duplicates
- resolve contradictions
- ignore weak or broken parts
- do NOT mention models

SIGNALS:
${signals.join("\n\n---\n\n")}

QUESTION:
${question}

FINAL ANSWER:
`;
}

/* =========================
   🚀 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  let webContext = "";

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

  const input = webContext
    ? `CONTEXT:\n${webContext}\n\nQUESTION:\n${message}`
    : message;

  /* =========================
     🎬 IMAGE MODE
  ========================= */
  if (needsImage(message)) {
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

      return { type: "image", payload: url, mode: "image" };
    } catch {
      return { type: "text", payload: "Image generation failed.", mode: "error" };
    }
  }

  /* =========================
     🔊 TTS MODE
  ========================= */
  if (needsTTS(message)) {
    try {
      const audio = await generateSpeech(message);
      return { type: "audio", payload: audio, mode: "tts" };
    } catch {
      return { type: "text", payload: "Audio generation failed.", mode: "error" };
    }
  }

  /* =========================
     🧠 PARALLEL MODELS (OPENAI + GROQ + OLLAMA)
  ========================= */

  const [openai, groq, ollama] = await Promise.all([
    safeCall(askOpenAI, contributorPrompt(input), history),
    safeCall(askGroq, contributorPrompt(input), history),
    safeCall(askOllama, contributorPrompt(input), history),
  ]);

  const signals: string[] = [];

  if (openai) signals.push(`OPENAI:\n${openai}`);
  if (groq) signals.push(`GROQ:\n${groq}`);
  if (ollama) signals.push(`OLLAMA:\n${ollama}`);

  /* =========================
     🚨 FALLBACK IF ALL FAIL
  ========================= */
  if (signals.length === 0) {
    return {
      type: "text",
      payload: "All AI models are currently unavailable. Please try again.",
      mode: "fallback",
    };
  }

  /* =========================
     🧠 FUSION STEP (PRIMARY: GROQ → FALLBACK CHAIN)
  ========================= */

  let final = "";

  const fusionInput = fusionPrompt(signals, message);

  try {
    final = await askGroq(fusionInput, history);
  } catch {
    try {
      final = await askOpenAI(fusionInput, history);
    } catch {
      try {
        final = await askOllama(fusionInput, history);
      } catch {
        final = signals[0]; // last-resort fallback
      }
    }
  }

  return {
    type: "text",
    payload: isValid(final) ? final : signals[0],
    webUsed: !!webContext,
    mode: "fusion",
  };
}