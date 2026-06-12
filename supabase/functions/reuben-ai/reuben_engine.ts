import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";
import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";

/* =========================
   🧠 SYSTEM IDENTITY (LOCKED)
   - NEVER passed to models
   - ONLY used by router
========================= */

const SYSTEM = {
  name: "ReuNexus AI",
  creator: "Reuben Murimi",
  type: "multi-model fusion AI system",
  models: ["OpenAI", "Groq", "Ollama"],
  description:
    "A professional AI system that fuses multiple reasoning models into a single response.",
};

/* =========================
   🧠 INTENT CLASSIFIER
========================= */

function getIntent(message: string) {
  const m = message.toLowerCase().trim();

  if (["hi", "hello", "hey", "yo"].includes(m)) return "greeting";

  if (
    m.includes("who are you") ||
    m.includes("what are you")
  ) return "identity";

  if (m.includes("image") || m.includes("picture")) return "image";

  if (m.includes("voice") || m.includes("audio") || m.includes("tts"))
    return "tts";

  if (
    m.includes("today") ||
    m.includes("latest") ||
    m.includes("news") ||
    m.includes("who is") ||
    m.includes("what is")
  ) return "web";

  return "reasoning";
}

/* =========================
   🧹 HISTORY CLEANER
========================= */

function sanitizeHistory(history: any[]) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m?.content && typeof m.content === "string")
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));
}

/* =========================
   🚨 VALIDATION FILTER
   (removes quota/error noise)
========================= */

function isValid(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase();

  return (
    t.length > 3 &&
    !t.includes("error") &&
    !t.includes("quota") &&
    !t.includes("rate limit") &&
    !t.includes("failed") &&
    !t.includes("unauthorized")
  );
}

/* =========================
   ⚖️ WEIGHT SCORING SYSTEM
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
   🧠 CONTRIBUTOR PROMPT
   (NO identity leakage allowed)
========================= */

const contributorPrompt = (input: string) => `
You are a reasoning component in a professional AI system.

STRICT RULES:
- Do NOT introduce yourself
- Do NOT mention the system or creator
- Do NOT answer greetings
- Only provide reasoning or factual fragments
- No final polished response

TASK:
${input}
`;

/* =========================
   🚀 MAIN ENGINE
========================= */

export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);
  const intent = getIntent(message);

  /* =========================
     🟢 IDENTITY (SYSTEM CONTROLLED)
  ========================= */

  if (intent === "identity") {
    return {
      type: "text",
      payload: `I am ${SYSTEM.name}, a ${SYSTEM.type} created by ${SYSTEM.creator}.`,
      mode: "identity",
      webUsed: false,
    };
  }

  /* =========================
     🟢 GREETING (CONSISTENT OUTPUT)
  ========================= */

  if (intent === "greeting") {
    return {
      type: "text",
      payload:
        "Hello. I am ReuNexus AI, a professional multi-model system designed for reasoning, analysis, and information processing.",
      mode: "conversation",
      webUsed: false,
    };
  }

  /* =========================
     🎬 IMAGE GENERATION
  ========================= */

  if (intent === "image") {
    try {
      const img = await generateImage(message);

      const url =
        typeof img === "string"
          ? img
          : img?.output_url || img?.url || img?.payload;

      if (!url) throw new Error();

      return { type: "image", payload: url, mode: "image" };
    } catch {
      return { type: "text", payload: "Image generation failed.", mode: "error" };
    }
  }

  /* =========================
     🔊 TEXT TO SPEECH
  ========================= */

  if (intent === "tts") {
    try {
      const audio = await generateSpeech(message);
      return { type: "audio", payload: audio, mode: "tts" };
    } catch {
      return { type: "text", payload: "Audio generation failed.", mode: "error" };
    }
  }

  /* =========================
     🌐 WEB ENRICHMENT
  ========================= */

  let webContext = "";

  if (intent === "web") {
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
    ? `CONTEXT:\n${webContext}\n\nQUESTION:\n${message}`
    : message;

  /* =========================
     🧠 PARALLEL MODEL EXECUTION
  ========================= */

  const results = await Promise.allSettled([
    askOpenAI(contributorPrompt(enrichedMessage), history),
    askGroq(contributorPrompt(enrichedMessage), history),
    askOllama(contributorPrompt(enrichedMessage), history),
  ]);

  const candidates: { text: string; model: string; score: number }[] = [];

  const models = ["openai", "groq", "ollama"];

  results.forEach((res, i) => {
    if (res.status === "fulfilled" && isValid(res.value)) {
      candidates.push({
        text: res.value,
        model: models[i],
        score: score(res.value, models[i]),
      });
    }
  });

  /* =========================
     🚨 NO VALID OUTPUT
  ========================= */

  if (candidates.length === 0) {
    return {
      type: "text",
      payload: "All reasoning models are currently unavailable.",
      mode: "fusion-fail",
      webUsed: !!webContext,
    };
  }

  /* =========================
     🧠 SELECT TOP SIGNALS
  ========================= */

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 3);

  const fusionInput = top
    .map(c => `${c.model.toUpperCase()}:\n${c.text}`)
    .join("\n\n---\n\n");

  /* =========================
     🧠 FINAL FUSION STEP
  ========================= */

  const fusionPrompt = `
You are a professional AI fusion engine.

TASK:
Combine multiple reasoning inputs into one clear and accurate response.

RULES:
- professional tone
- remove repetition
- ignore weak or incomplete reasoning
- never mention models or system internals

INPUT:
${fusionInput}

QUESTION:
${message}

FINAL ANSWER:
`;

  let final = "";

  try {
    final = await askGroq(fusionPrompt, history);
  } catch {
    try {
      final = await askOpenAI(fusionPrompt, history);
    } catch {
      final = await askOllama(fusionPrompt, history);
    }
  }

  return {
    type: "text",
    payload: isValid(final)
      ? final
      : "Unable to generate a stable response. Please try again.",
    mode: "weighted-fusion",
    webUsed: !!webContext,
  };
}