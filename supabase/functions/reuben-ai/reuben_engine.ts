import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";
import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";

/* =========================
   🧠 INTENT CLASSIFIER
========================= */

function getIntent(message: string) {
  const msg = message.toLowerCase().trim();

  if (["hi", "hello", "hey", "yo"].includes(msg)) return "greeting";

  if (msg.includes("who are you") || msg.includes("what are you"))
    return "identity";

  if (
    msg.includes("image") ||
    msg.includes("picture") ||
    msg.includes("draw") ||
    msg.includes("generate image")
  )
    return "image";

  if (
    msg.includes("speak") ||
    msg.includes("voice") ||
    msg.includes("audio") ||
    msg.includes("tts")
  )
    return "tts";

  if (
    msg.includes("today") ||
    msg.includes("latest") ||
    msg.includes("news") ||
    msg.includes("what is") ||
    msg.includes("who is")
  )
    return "web";

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
   🚨 VALIDATION (IGNORE BAD OUTPUTS)
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
   ⚡ WEIGHT SCORING
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
========================= */

const contributorPrompt = (input: string) => `
You are a reasoning contributor.

RULES:
- no greetings
- no identity
- only useful reasoning
- do NOT give final polished answer

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
     🟢 GREETING / CHAT MODE
  ========================= */

  if (intent === "greeting") {
    return {
      type: "text",
      payload:
        "Hey 👋 I'm ReuNexus AI — a multi-model fusion system (OpenAI, Groq, Ollama). Ask me anything.",
      mode: "conversation",
      webUsed: false,
    };
  }

  if (intent === "identity") {
    return {
      type: "text",
      payload: "I was created by Reuben Murimi.",
      mode: "identity",
      webUsed: false,
    };
  }

  /* =========================
     🎬 IMAGE MODE
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
      return { type: "text", payload: "Image failed.", mode: "error" };
    }
  }

  /* =========================
     🔊 TTS MODE
  ========================= */

  if (intent === "tts") {
    try {
      const audio = await generateSpeech(message);
      return { type: "audio", payload: audio, mode: "tts" };
    } catch {
      return { type: "text", payload: "Audio failed.", mode: "error" };
    }
  }

  /* =========================
     🌐 WEB MODE
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

  const enriched = webContext
    ? `CONTEXT:\n${webContext}\n\nQUESTION:\n${message}`
    : message;

  /* =========================
     🧠 PARALLEL MODELS (FUSION CORE)
  ========================= */

  const results = await Promise.allSettled([
    askOpenAI(contributorPrompt(enriched), history),
    askGroq(contributorPrompt(enriched), history),
    askOllama(contributorPrompt(enriched), history),
  ]);

  const labeled = [
    { model: "openai", res: results[0] },
    { model: "groq", res: results[1] },
    { model: "ollama", res: results[2] },
  ];

  /* =========================
     🧠 FILTER + SCORE
  ========================= */

  const candidates: { text: string; model: string; score: number }[] = [];

  for (const item of labeled) {
    if (item.res.status === "fulfilled") {
      const text = item.res.value;

      if (isValid(text)) {
        candidates.push({
          text,
          model: item.model,
          score: score(text, item.model),
        });
      }
    }
  }

  /* =========================
     🧠 FALLBACK IF ALL FAIL
  ========================= */

  if (candidates.length === 0) {
    return {
      type: "text",
      payload: "No AI models returned a valid response. Try again.",
      mode: "fusion-fail",
      webUsed: !!webContext,
    };
  }

  /* =========================
     🧠 PICK BEST SIGNALS
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
You are a fusion reasoning engine.

TASK:
Combine all model outputs into ONE final answer.

RULES:
- merge best ideas
- remove repetition
- ignore weak or broken parts
- do NOT mention models

INPUTS:
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
      : "I couldn't generate a strong response. Please rephrase.",
    mode: "weighted-fusion",
    webUsed: !!webContext,
  };
}