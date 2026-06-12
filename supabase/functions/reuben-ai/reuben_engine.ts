import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";
import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";

/* =========================
   🧠 INTENT ROUTER
========================= */
function detectIntent(message: string) {
  const msg = message.toLowerCase().trim();

  if (
    msg === "hi" ||
    msg === "hello" ||
    msg === "hey" ||
    msg.includes("who are you") ||
    msg.includes("what are you") ||
    msg.includes("who made you")
  ) {
    return "conversation";
  }

  if (
    msg.includes("image") ||
    msg.includes("draw") ||
    msg.includes("generate image")
  ) return "image";

  if (
    msg.includes("speak") ||
    msg.includes("voice") ||
    msg.includes("audio")
  ) return "audio";

  if (
    msg.includes("today") ||
    msg.includes("latest") ||
    msg.includes("news") ||
    msg.includes("what is") ||
    msg.includes("who is")
  ) return "web";

  return "reasoning";
}

/* =========================
   🧹 HISTORY
========================= */
function sanitizeHistory(history: any[]) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m?.content)
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));
}

/* =========================
   🧠 SAFE CHECK
========================= */
function isValid(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase();
  if (t.includes("quota")) return false;
  if (t.includes("error")) return false;
  if (t.includes("failed")) return false;
  if (t.length < 3) return false;

  return true;
}

/* =========================
   🧠 WEIGHT SCORE
========================= */
function score(text: string, model: string) {
  let s = 1;

  if (text.length > 200) s += 1;
  if (text.length > 500) s += 1;
  if (text.includes("\n")) s += 0.5;

  if (model === "openai") s += 1.2;
  if (model === "groq") s += 1.0;
  if (model === "ollama") s += 0.8;

  return s;
}

/* =========================
   🚀 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  const intent = detectIntent(message);

  /* =========================
     🧠 1. CONVERSATION MODE
  ========================= */
  if (intent === "conversation") {
    if (message.toLowerCase().includes("who made you")) {
      return {
        type: "text",
        payload: "I was created by Reuben Murimi.",
        mode: "conversation",
      };
    }

    return {
      type: "text",
      payload:
        "Hello 👋 I'm ReuNexus AI — a multi-model fusion system built for reasoning, analysis, and assistance. How can I help you?",
      mode: "conversation",
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

      return { type: "image", payload: url, mode: "image" };
    } catch {
      return { type: "text", payload: "Image failed.", mode: "error" };
    }
  }

  /* =========================
     🔊 AUDIO MODE
  ========================= */
  if (intent === "audio") {
    try {
      const audio = await generateSpeech(message);
      return { type: "audio", payload: audio, mode: "audio" };
    } catch {
      return { type: "text", payload: "Audio failed.", mode: "error" };
    }
  }

  /* =========================
     🌐 WEB MODE (optional enrichment)
  ========================= */
  let webContext = "";
  if (intent === "web") {
    try {
      const search = await searchTavily(message);
      webContext =
        search?.answer ||
        search?.results?.map((r: any) => r.content).join("\n") ||
        "";
    } catch {}
  }

  const enriched = webContext
    ? `CONTEXT:\n${webContext}\n\nQUESTION:\n${message}`
    : message;

  /* =========================
     🧠 MULTI-MODEL CONTRIBUTION (SAFE)
  ========================= */
  const prompt = `
You are a reasoning contributor.
Provide useful reasoning only.
No identity. No greeting.

TASK:
${enriched}
`;

  const results = await Promise.allSettled([
    askOpenAI(prompt, history),
    askGroq(prompt, history),
    askOllama(prompt, history),
  ]);

  const labeled = [
    { model: "openai", res: results[0] },
    { model: "groq", res: results[1] },
    { model: "ollama", res: results[2] },
  ];

  const scored: any[] = [];

  for (const r of labeled) {
    if (r.res.status === "fulfilled" && isValid(r.res.value)) {
      scored.push({
        model: r.model,
        text: r.res.value,
        score: score(r.res.value, r.model),
      });
    }
  }

  if (scored.length === 0) {
    return {
      type: "text",
      payload: "No valid responses available. Try again.",
      mode: "fusion",
    };
  }

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 3);

  const fusionPrompt = `
You are a fusion engine.

Combine reasoning into ONE final response.

RULES:
- merge insights
- remove duplicates
- ignore model names
- be clear and professional

INPUTS:
${top.map(t => `${t.model}: ${t.text}`).join("\n\n")}

QUESTION:
${message}

FINAL ANSWER:
`;

  /* =========================
     🧠 SAFE FUSION FALLBACK CHAIN
  ========================= */
  let final = "";

  try {
    final = await askOpenAI(fusionPrompt, history);
  } catch {
    try {
      final = await askGroq(fusionPrompt, history);
    } catch {
      try {
        final = await askOllama(fusionPrompt, history);
      } catch {
        final = "All models failed. Please try again.";
      }
    }
  }

  return {
    type: "text",
    payload: final,
    mode: "weighted-fusion",
    webUsed: !!webContext,
  };
}