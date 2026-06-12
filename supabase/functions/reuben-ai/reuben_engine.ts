import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";
import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";

/* =========================
   🧹 HISTORY
========================= */
function sanitizeHistory(history: any[]) {
  if (!Array.isArray(history)) return [];
  return history.slice(-10).map(m => ({
    role: m.role,
    content: m.content,
  }));
}

/* =========================
   🔁 SAFE CALL WRAPPER (KEY FIX)
========================= */
async function safeCall(fn: Function, ...args: any[]) {
  try {
    const res = await fn(...args);
    if (!res || typeof res !== "string") return null;
    return res;
  } catch {
    return null;
  }
}

/* =========================
   ⚖️ SCORE ENGINE
========================= */
function score(text: string, model: string) {
  let s = 1;

  if (text.length > 200) s += 1;
  if (text.length > 500) s += 1;
  if (text.includes("\n")) s += 0.5;

  if (model === "openai") s += 1.2;
  if (model === "groq") s += 1.0;
  if (model === "ollama") s += 0.9;

  return s;
}

/* =========================
   🧠 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  /* =========================
     🌐 WEB (OPTIONAL)
  ========================= */
  let webContext = "";
  try {
    const search = await searchTavily(message);
    webContext =
      search?.answer ||
      search?.results?.map((r: any) => r.content).join("\n") ||
      "";
  } catch {
    webContext = "";
  }

  const input = webContext
    ? `Context:\n${webContext}\n\nUser:\n${message}`
    : message;

  /* =========================
     🎬 IMAGE MODE
  ========================= */
  if (message.toLowerCase().includes("image")) {
    try {
      const img = await generateImage(message);
      const url =
        typeof img === "string"
          ? img
          : img?.output_url || img?.url || img?.payload;

      return { type: "image", payload: url, mode: "image" };
    } catch {
      return { type: "text", payload: "Image failed.", mode: "error" };
    }
  }

  /* =========================
     🔊 TTS MODE
  ========================= */
  if (message.toLowerCase().includes("voice")) {
    try {
      const audio = await generateSpeech(message);
      return { type: "audio", payload: audio, mode: "tts" };
    } catch {
      return { type: "text", payload: "Audio failed.", mode: "error" };
    }
  }

  /* =========================
     🧠 PARALLEL EXECUTION (SAFE)
  ========================= */
  const [openai, groq, ollama] = await Promise.all([
    safeCall(askOpenAI, input, history),
    safeCall(askGroq, input, history),
    safeCall(askOllama, input, history),
  ]);

  const candidates = [
    openai && { text: openai, model: "openai" },
    groq && { text: groq, model: "groq" },
    ollama && { text: ollama, model: "ollama" },
  ].filter(Boolean) as any[];

  /* =========================
     🚨 HARD GUARANTEE FALLBACK
  ========================= */
  if (candidates.length === 0) {
    // LAST RESORT: always respond
    return {
      type: "text",
      payload:
        "I’m currently experiencing high load across all AI providers. Please try again in a moment.",
      mode: "hard-fallback",
    };
  }

  /* =========================
     ⚖️ WEIGHTED PICK
  ========================= */
  const scored = candidates.map(c => ({
    ...c,
    score: score(c.text, c.model),
  }));

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];

  /* =========================
     🧠 IF ONLY ONE MODEL WORKS
  ========================= */
  if (scored.length === 1) {
    return {
      type: "text",
      payload: best.text,
      mode: "single-model",
    };
  }

  /* =========================
     🧠 FUSION STEP (OPTIONAL ENHANCEMENT)
  ========================= */
  const fusionPrompt = `
You are a fusion engine.

Combine the following answers into one:

${scored.map(s => `${s.model}: ${s.text}`).join("\n\n")}

User question:
${message}

Final answer:
`;

  let final = "";

  try {
    final = await askGroq(fusionPrompt, history);
  } catch {
    final = best.text; // fallback to best model instantly
  }

  return {
    type: "text",
    payload: final,
    mode: "self-healing-fusion",
  };
}