import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";

import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";

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
    .map(m => ({ role: m.role, content: m.content }));
}

/* =========================
   🧠 VALIDATION
========================= */
function isValid(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase().trim();

  if (t.length < 3) return false;
  if (
    t.includes("error") ||
    t.includes("quota") ||
    t.includes("rate limit") ||
    t.includes("failed") ||
    t.includes("unauthorized")
  ) {
    return false;
  }

  return true;
}

/* =========================
   🧠 WEIGHT SCORING SYSTEM
========================= */
function scoreAnswer(text: string, model: string) {
  let score = 1;

  // length quality signal
  if (text.length > 200) score += 1;
  if (text.length > 500) score += 1;

  // structure signal
  if (text.includes("\n")) score += 0.5;

  // model reliability bias (you can tune this)
  if (model === "openai") score += 1.2;
  if (model === "groq") score += 1.0;
  if (model === "ollama") score += 0.9;

  return score;
}

/* =========================
   🧠 CONTRIBUTOR PROMPT
========================= */
const contributorPrompt = (input: string) => `
You are a reasoning contributor.

RULES:
- NO greetings
- NO assistant identity
- ONLY reasoning fragments
- NO final answer

TASK:
${input}
`;

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
      ? `CONTEXT:\n${webContext}\n\nQUESTION:\n${message}`
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
       🧠 PARALLEL MODELS
    ========================= */

    const results = await Promise.allSettled([
      askOpenAI(contributorPrompt(enrichedMessage), history),
      askGroq(contributorPrompt(enrichedMessage), history),
      askOllama(contributorPrompt(enrichedMessage), history),
    ]);

    const labeled = [
      { model: "openai", res: results[0] },
      { model: "groq", res: results[1] },
      { model: "ollama", res: results[2] },
    ];

    /* =========================
       🧠 WEIGHTED SELECTION
    ========================= */

    const scored: { text: string; score: number; model: string }[] = [];

    for (const item of labeled) {
      if (item.res.status === "fulfilled") {
        const text = item.res.value;

        if (isValid(text)) {
          scored.push({
            text,
            model: item.model,
            score: scoreAnswer(text, item.model),
          });
        }
      }
    }

    if (scored.length === 0) {
      return {
        type: "text",
        payload:
          "All AI models failed or returned weak responses. Please try again.",
        webUsed: !!webContext,
        mode: "fusion",
      };
    }

    // sort by intelligence score
    scored.sort((a, b) => b.score - a.score);

    const topSignals = scored
      .slice(0, 3) // only best contributors
      .map(
        s => `${s.model.toUpperCase()} (score ${s.score.toFixed(1)}):\n${s.text}`
      );

    /* =========================
       🧠 FINAL FUSION
    ========================= */

    const fusionPrompt = `
You are a weighted fusion reasoning engine.

TASK:
Combine the strongest signals into ONE final answer.

RULES:
- prioritize higher-quality reasoning
- remove duplicates
- ignore weak or noisy parts
- no model names in final output

SIGNALS:
${topSignals.join("\n\n---\n\n")}

QUESTION:
${message}

FINAL ANSWER:
`;

    let result = "";

    try {
      result = await askGroq(fusionPrompt, history);
    } catch {
      try {
        result = await askOllama(fusionPrompt, history);
      } catch {
        result = await askOpenAI(fusionPrompt, history);
      }
    }

    return {
      type: "text",
      payload: result,
      webUsed: !!webContext,
      mode: "weighted-fusion",
    };
  } catch (err) {
    return {
      type: "text",
      payload: "System error in weighted fusion engine.",
      webUsed: false,
      mode: "error",
    };
  }
}