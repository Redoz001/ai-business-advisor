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
   🚨 VALIDATION
========================= */
function isValid(text: any) {
  if (!text || typeof text !== "string") return false;

  const t = text.toLowerCase();
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
   🧠 MODEL-BASED INTENT DETECTION
   (NO RULES, NO HARD CODING)
========================= */
async function detectIntent(message: string) {
  const prompt = `
You are an intent classifier.

Classify the message into ONE category:

- greeting
- identity
- image
- tts
- web
- reasoning

Rules:
- Return ONLY one word
- No explanation

Message:
${message}
`;

  const results = await Promise.allSettled([
    askOpenAI(prompt, []),
    askGroq(prompt, []),
    askOllama(prompt, []),
  ]);

  const votes: string[] = [];

  for (const r of results) {
    if (r.status === "fulfilled" && typeof r.value === "string") {
      votes.push(r.value.toLowerCase().trim());
    }
  }

  if (votes.length === 0) return "reasoning";

  const freq: Record<string, number> = {};

  for (const v of votes) {
    freq[v] = (freq[v] || 0) + 1;
  }

  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

/* =========================
   ⚖️ SCORING SYSTEM
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
   🚀 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  /* =========================
     🧠 STEP 1: INTENT (MODEL VOTING)
  ========================= */
  const intent = await detectIntent(message);

  /* =========================
     🟢 CONVERSATION MODE
  ========================= */
  if (intent === "greeting") {
    const reply = await askGroq(
      `Respond naturally and professionally to this greeting in its language:
       "${message}"`
    );

    return {
      type: "text",
      payload: reply,
      mode: "conversation",
    };
  }

  /* =========================
     🧠 IDENTITY MODE
  ========================= */
  if (intent === "identity") {
    const reply = await askOpenAI(`
Explain who you are as a system:
You are a multi-model fusion AI using OpenAI, Groq, and Ollama.

User message:
${message}
    `);

    return {
      type: "text",
      payload: reply,
      mode: "identity",
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
     🔊 AUDIO MODE
  ========================= */
  if (intent === "tts") {
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
    } catch {}
  }

  const enriched = webContext
    ? `CONTEXT:\n${webContext}\n\nQUESTION:\n${message}`
    : message;

  /* =========================
     🧠 STEP 2: PARALLEL MODELS
  ========================= */
  const prompt = `
You are a reasoning contributor.

Provide useful reasoning only.

Task:
${enriched}
`;

  const results = await Promise.allSettled([
    askOpenAI(prompt, history),
    askGroq(prompt, history),
    askOllama(prompt, history),
  ]);

  const candidates: { text: string; model: string; score: number }[] = [];

  const models = ["openai", "groq", "ollama"];

  results.forEach((r, i) => {
    if (r.status === "fulfilled" && isValid(r.value)) {
      candidates.push({
        text: r.value,
        model: models[i],
        score: score(r.value, models[i]),
      });
    }
  });

  /* =========================
     🚨 FALLBACK IF ALL FAIL
  ========================= */
  if (candidates.length === 0) {
    return {
      type: "text",
      payload: "All models are currently unavailable.",
      mode: "fusion-fail",
    };
  }

  /* =========================
     🧠 STEP 3: WEIGHTED SELECTION
  ========================= */
  candidates.sort((a, b) => b.score - a.score);

  const top = candidates.slice(0, 3);

  const fusionInput = top
    .map(c => `${c.model.toUpperCase()}:\n${c.text}`)
    .join("\n\n---\n\n");

  /* =========================
     🧠 STEP 4: FINAL FUSION
  ========================= */
  const fusionPrompt = `
You are a professional AI fusion engine.

Combine multiple reasoning outputs into ONE clear response.

Rules:
- remove duplicates
- resolve contradictions
- keep professional tone
- do NOT mention models

Inputs:
${fusionInput}

Question:
${message}

Final Answer:
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
      : "Unable to generate stable response. Please try again.",
    mode: "true-fusion",
  };
}