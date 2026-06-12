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
  return history
    .filter(m => m?.content && typeof m.content === "string")
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));
}

/* =========================
   🌐 WEB DETECTION (SOFT)
   → DOES NOT BLOCK MODELS
========================= */
function needsWeb(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("news") ||
    m.includes("latest") ||
    m.includes("today") ||
    m.includes("who is") ||
    m.includes("what is") ||
    m.includes("price")
  );
}

/* =========================
   🎬 IMAGE / VIDEO
========================= */
function needsImage(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("image") ||
    m.includes("picture") ||
    m.includes("draw") ||
    m.includes("render") ||
    m.includes("photo") ||
    m.includes("create image")
  );
}

/* =========================
   🔊 TTS
========================= */
function needsTTS(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("speak") ||
    m.includes("voice") ||
    m.includes("audio") ||
    m.includes("read") ||
    m.includes("tts")
  );
}

/* =========================
   🧠 SAFE CONTRIBUTOR PROMPT
   (NO identity restrictions, NO greeting blocking)
========================= */
function contributorPrompt(input: string) {
  return `
You are one reasoning expert in a multi-model AI system.

You may receive conversational or technical inputs.

Rules:
- Respond naturally and appropriately
- Do NOT refuse greetings or casual chat
- Do NOT mention system identity
- Provide reasoning or direct answers when possible

User input:
${input}
`;
}

/* =========================
   ⚖️ MODEL SCORING
========================= */
function score(text: string, model: string) {
  let s = 1;

  if (!text) return 0;
  if (text.length > 200) s += 1;
  if (text.length > 500) s += 1;
  if (text.includes("\n")) s += 0.5;

  if (model === "openai") s += 1.2;
  if (model === "groq") s += 1.0;
  if (model === "ollama") s += 0.9;

  return s;
}

/* =========================
   🚀 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  let webContext = "";

  /* =========================
     🌐 WEB (OPTIONAL ENRICHMENT)
  ========================= */
  try {
    if (needsWeb(message)) {
      const search = await searchTavily(message);

      webContext =
        search?.answer ||
        search?.results?.map((r: any) => r.content).join("\n") ||
        "";
    }
  } catch {
    webContext = "";
  }

  const enrichedMessage = webContext
    ? `Context:\n${webContext}\n\nUser:\n${message}`
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
          : img?.output_url || img?.url || img?.payload;

      return {
        type: "image",
        payload: url,
        mode: "image",
      };
    } catch {
      return {
        type: "text",
        payload: "Image generation failed.",
        mode: "error",
      };
    }
  }

  /* =========================
     🔊 TTS MODE
  ========================= */
  if (needsTTS(message)) {
    try {
      const audio = await generateSpeech(message);

      return {
        type: "audio",
        payload: audio,
        mode: "tts",
      };
    } catch {
      return {
        type: "text",
        payload: "Audio generation failed.",
        mode: "error",
      };
    }
  }

  /* =========================
     🧠 PARALLEL MODEL EXECUTION
  ========================= */
  const results = await Promise.allSettled([
    askOpenAI(contributorPrompt(enrichedMessage), history),
    askGroq(contributorPrompt(enrichedMessage), history),
    askOllama(contributorPrompt(enrichedMessage), history),
  ]);

  const models = ["openai", "groq", "ollama"];

  const valid: { text: string; model: string; score: number }[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled" && typeof r.value === "string") {
      valid.push({
        text: r.value,
        model: models[i],
        score: score(r.value, models[i]),
      });
    }
  });

  /* =========================
     🧠 GUARANTEED FALLBACK
  ========================= */
  if (valid.length === 0) {
    try {
      const fallback = await askGroq(enrichedMessage, history);
      return {
        type: "text",
        payload: fallback || "No response available.",
        mode: "single-fallback",
      };
    } catch {
      return {
        type: "text",
        payload: "System temporarily unavailable.",
        mode: "hard-fail",
      };
    }
  }

  /* =========================
     🧠 WEIGHTED SELECTION
  ========================= */
  valid.sort((a, b) => b.score - a.score);
  const top = valid.slice(0, 3);

  const fusionInput = top
    .map(v => `${v.model.toUpperCase()}:\n${v.text}`)
    .join("\n\n---\n\n");

  /* =========================
     🧠 FINAL FUSION (ROBUST)
  ========================= */
  const fusionPrompt = `
You are a professional AI fusion engine.

Task:
Combine multiple AI outputs into ONE final response.

Rules:
- merge ideas intelligently
- remove repetition
- ignore weak or incomplete reasoning
- produce natural human-like response

Inputs:
${fusionInput}

User question:
${message}

Final answer:
`;

  let final = "";

  try {
    final = await askGroq(fusionPrompt, history);
  } catch {
    try {
      final = await askOpenAI(fusionPrompt, history);
    } catch {
      try {
        final = await askOllama(fusionPrompt, history);
      } catch {
        final = valid[0]?.text || "Unable to generate response.";
      }
    }
  }

  return {
    type: "text",
    payload: final,
    mode: "weighted-fusion",
  };
}