import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";
import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";

/* =========================
   🧠 CONVERSATION MODE FIX
========================= */
function isConversation(message: string) {
  const msg = message.toLowerCase().trim();

  return (
    ["hi", "hello", "hey", "yo", "sup"].includes(msg) ||
    msg.includes("who are you") ||
    msg.includes("what are you") ||
    msg.includes("help")
  );
}

/* =========================
   🌐 DETECTORS
========================= */
function needsWeb(message: string) {
  const msg = message.toLowerCase();
  return (
    msg.includes("today") ||
    msg.includes("latest") ||
    msg.includes("news") ||
    msg.includes("price") ||
    msg.includes("who is") ||
    msg.includes("what is")
  );
}

function needsRunway(message: string) {
  const msg = message.toLowerCase();
  return (
    msg.includes("image") ||
    msg.includes("draw") ||
    msg.includes("photo") ||
    msg.includes("generate image") ||
    msg.includes("video")
  );
}

function needsElevenLabs(message: string) {
  const msg = message.toLowerCase();
  return (
    msg.includes("speak") ||
    msg.includes("voice") ||
    msg.includes("audio") ||
    msg.includes("read")
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
    .map(m => ({ role: m.role, content: m.content }));
}

/* =========================
   🧠 VALIDATION (FILTER BAD OUTPUTS)
========================= */
function isValid(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase();
  if (t.length < 3) return false;

  return !(
    t.includes("error") ||
    t.includes("quota") ||
    t.includes("rate limit") ||
    t.includes("failed") ||
    t.includes("unauthorized")
  );
}

/* =========================
   ⚖️ WEIGHT SCORING
========================= */
function scoreAnswer(text: string, model: string) {
  let score = 1;

  if (text.length > 200) score += 1;
  if (text.length > 500) score += 1;
  if (text.includes("\n")) score += 0.5;

  if (model === "openai") score += 1.2;
  if (model === "groq") score += 1.0;
  if (model === "ollama") score += 0.9;

  return score;
}

/* =========================
   🚀 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  /* =========================
     🧠 1. CONVERSATION LAYER (FIX YOUR BUG)
  ========================= */
  if (isConversation(message)) {
    return {
      type: "text",
      payload:
        "Hey 👋 I'm ReuNexus AI — a multi-model fusion system using OpenAI, Groq, and Ollama. Ask me anything!",
      webUsed: false,
      mode: "conversation",
    };
  }

  let webContext = "";

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
    } catch {}
  }

  const enrichedMessage = webContext
    ? `CONTEXT:\n${webContext}\n\nQUESTION:\n${message}`
    : message;

  /* =========================
     🎬 IMAGE GENERATION
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
     🧠 CONTRIBUTOR PROMPT (SAFE)
  ========================= */
  const contributorPrompt = `
You are a reasoning contributor.

RULES:
- NO greetings unless asked
- NO identity
- ONLY reasoning fragments
- DO NOT refuse simple input
- DO NOT ask for context

TASK:
${enrichedMessage}
`;

  /* =========================
     ⚡ PARALLEL EXECUTION
  ========================= */
  const [openaiR, groqR, ollamaR] = await Promise.allSettled([
    askOpenAI(contributorPrompt, history),
    askGroq(contributorPrompt, history),
    askOllama(contributorPrompt, history),
  ]);

  const contributions: any[] = [];

  const add = (res: any, model: string) => {
    if (res.status === "fulfilled" && isValid(res.value)) {
      contributions.push({
        model,
        text: res.value,
        score: scoreAnswer(res.value, model),
      });
    }
  };

  add(openaiR, "openai");
  add(groqR, "groq");
  add(ollamaR, "ollama");

  if (contributions.length === 0) {
    return {
      type: "text",
      payload: "All models failed. Please try again.",
      webUsed: !!webContext,
      mode: "fusion-failed",
    };
  }

  /* =========================
     🧠 WEIGHTED SELECTION
  ========================= */
  contributions.sort((a, b) => b.score - a.score);

  const top = contributions.slice(0, 3);

  const fusionPrompt = `
You are a Fusion Brain.

Combine all reasoning into ONE final response.

RULES:
- merge ideas
- remove repetition
- ignore noise or errors
- no model names

${top.map(t => `${t.model.toUpperCase()}:\n${t.text}`).join("\n\n---\n\n")}

QUESTION:
${message}

FINAL ANSWER:
`;

  /* =========================
     🧠 FINAL FUSION FALLBACK CHAIN
  ========================= */

  let result = "";

  try {
    result = await askGroq(fusionPrompt, history);
  } catch {
    try {
      result = await askOpenAI(fusionPrompt, history);
    } catch {
      try {
        result = await askOllama(fusionPrompt, history);
      } catch {
        result = top[0]?.text || "No valid response generated.";
      }
    }
  }

  return {
    type: "text",
    payload: result,
    webUsed: !!webContext,
    mode: "weighted-fusion",
  };
}