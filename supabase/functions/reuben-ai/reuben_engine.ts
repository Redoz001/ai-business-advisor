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
   🌐 WEB DETECTOR
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

/* =========================
   🎬 RUNWAY DETECTOR
========================= */
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

/* =========================
   🔊 ELEVENLABS DETECTOR
========================= */
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
   🧹 HISTORY SANITIZER
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
   🧠 CONTRIBUTOR PROMPT (CRITICAL FIX)
========================= */
function buildContributorPrompt(message: string) {
  return `
You are NOT an assistant.

You are ONE reasoning contributor in a multi-model AI system.

RULES:
- NO greetings
- NO self-introduction
- NO final answer
- NO assistant tone
- ONLY facts, reasoning, ideas, steps
- Keep it short and useful

User request:
${message}

Output ONLY:
- bullet points
- reasoning fragments
- key insights
`;
}

/* =========================
   🚀 MAIN ENGINE (REAL FUSION ARCHITECTURE)
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);

  let webContext = "";

  try {
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
      } catch (err: any) {
        webContext = "";
      }
    }

    const enrichedMessage = webContext
      ? `
Use context only if relevant.

CONTEXT:
${webContext}

USER QUESTION:
${message}
`
      : message;

    /* =========================
       🎬 IMAGE / VIDEO
    ========================= */
    if (needsRunway(message)) {
      try {
        const imageResult = await generateImage(message);

        const finalUrl =
          typeof imageResult === "string"
            ? imageResult
            : imageResult?.output_url ||
              imageResult?.url ||
              imageResult?.payload ||
              (Array.isArray(imageResult?.output) ? imageResult.output[0] : null) ||
              (Array.isArray(imageResult?.result) ? imageResult.result[0] : null);

        if (!finalUrl) throw new Error("No image URL");

        return {
          type: "image",
          payload: finalUrl,
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
       🔊 TEXT TO SPEECH
    ========================= */
    if (needsElevenLabs(message)) {
      try {
        const audioUrl = await generateSpeech(message);

        return {
          type: "audio",
          payload: audioUrl,
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
       🧠 PARALLEL CONTRIBUTORS
    ========================= */

    const contributorPrompt = buildContributorPrompt(enrichedMessage);

    const [openaiRes, groqRes, ollamaRes] = await Promise.allSettled([
      askOpenAI(contributorPrompt, history),
      askGroq(contributorPrompt, history),
      askOllama(contributorPrompt, history),
    ]);

    const openai = openaiRes.status === "fulfilled" ? openaiRes.value : "";
    const groq = groqRes.status === "fulfilled" ? groqRes.value : "";
    const ollama = ollamaRes.status === "fulfilled" ? ollamaRes.value : "";

    const signals: string[] = [];

    if (openai) signals.push(`OPENAI:\n${openai}`);
    if (groq) signals.push(`GROQ:\n${groq}`);
    if (ollama) signals.push(`OLLAMA:\n${ollama}`);

    /* =========================
       🧠 FUSION ENGINE (FINAL BRAIN)
    ========================= */

    let result = "";

    if (signals.length === 0) {
      result =
        "No AI models responded. Please try again or rephrase your question.";
    } else {
      result = await askOpenAI(`
You are a Fusion Engine.

Your job is to merge multiple reasoning signals into ONE final answer.

RULES:
- Combine all useful ideas
- Remove repetition
- Resolve contradictions
- Do NOT mention model names
- Be clear, structured, and helpful

SIGNALS:
${signals.join("\n\n---\n\n")}

USER QUESTION:
${message}

FINAL ANSWER:
      `);
    }

    return {
      type: "text",
      payload: result,
      webUsed: !!webContext,
      mode: "fusion",
    };

  } catch (err: any) {
    return {
      type: "text",
      payload: "System error in ReuNexus AI.",
      webUsed: false,
      mode: "error",
    };
  }
}