import { askGroq } from "./providers/groq.ts";
import { askOpenAI } from "./providers/openai.ts";
import { askOllama } from "./providers/ollama.ts";
import { searchTavily } from "./providers/tavily.ts";

import { generateImage } from "./providers/runway.ts";
import { generateSpeech } from "./providers/elevenlabs.ts";
import { generateLocalImage } from "./providers/reucore.ts";

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
  const msg = message.toLowerCase().trim();
  if (
    msg.includes("my name") ||
    msg.includes("remember") ||
    msg.includes("i just told you") ||
    msg.includes("our conversation") ||
    msg.includes("we were talking about") ||
    msg.includes("what did i say") ||
    msg.includes("what were we talking about")
  ) {
    return false;
  }
  return (
    msg.includes("today") ||
    msg.includes("current") ||
    msg.includes("who is") ||
    msg.includes("price")
  );
}

/* =========================
   🎬 VISUAL DETECTOR (IMAGE/VIDEO)
========================= */
function needsVisual(message: string) {
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
    msg.includes("clip") ||
    msg.includes("animate")
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
   🧠 SMART ROUTER
========================= */
async function routeModel(message: string): Promise<"openai" | "groq"> {
  if (Deno.env.get("OPENAI_ENABLED") !== "true") {
    return "groq";
  }

  try {
    const decision = await askGroq(
      `You are an AI routing engine. Return {"model":"openai"} or {"model":"groq"}. User: ${message}`,
      []
    );
    const parsed = JSON.parse(decision);
    if (parsed?.model === "openai") return "openai";
    return "groq";
  } catch {
    return "groq";
  }
}

/* =========================
   🧹 HISTORY SANITIZER
========================= */
function sanitizeHistory(history: any[]) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-10)
    .map(m => ({
      role: m.role,
      content: m.content,
    }));
}

/* =========================
   🧠 CONVERSATION STATE
========================= */
function buildConversationState(history: any[], currentMessage: string) {
  const recentDiscussion = [
    ...history,
    { role: "user", content: currentMessage },
  ]
    .slice(-12)
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");
  return {
    role: "system",
    content: `
CURRENT CONVERSATION CONTEXT
You are in an ongoing conversation.
Your responsibilities:
- Understand what topic is currently being discussed.
- Keep track of facts mentioned by the user.
- Remember information shared earlier in this conversation.
- Assume follow-up questions refer to the current discussion unless the user clearly changes topics.
- Maintain continuity.
- Never ask the user to repeat information already present in the conversation.
- If the user asks about information they already provided in this conversation, answer using the conversation history.
Recent discussion:
${recentDiscussion}
    `.trim(),
  };
}

/* =========================
   🧠 USER FACTS STATE
========================= */
function buildFactState(history: any[], currentMessage: string) {
  let name = "";
  const messages = [...history, { role: "user", content: currentMessage }];
  for (const m of messages) {
    if (m.role !== "user") continue;
    const match = m.content.match(/my name is\s+(.+)/i);
    if (match) {
      name = match[1].trim();
    }
  }
  const facts = name ? [`Name: ${name}`] : [];
  return {
    role: "system",
    content: `
CURRENT USER FACTS
${facts.join("\n")}
    `.trim(),
  };
}

function isLocalModelEnabled() {
  return Deno.env.get("OLLAMA_ENABLED") === "true";
}

/* =========================
   🚀 MAIN ENGINE
========================= */
export async function routeRequest(message: string, context: any) {
  const history = sanitizeHistory(context?.sessionHistory || []);
  console.log("SESSION HISTORY:", JSON.stringify(context?.sessionHistory, null, 2));

  const conversationState = buildConversationState(history, message);
  const factState = buildFactState(history, message);
  const contextMessages = [conversationState, factState, ...history];

  let webContext = "";

  try {
    /* =========================
       🌐 WEB SEARCH
    ========================= */
    if (needsWeb(message)) {
      console.log("🌐 Tavily search triggered");
      try {
        const search = await searchTavily(message);
        webContext =
          search?.answer ||
          search?.results?.map((r: any) => r.content).join("\n") ||
          "";
      } catch (err: any) {
        console.warn("Tavily failed:", err.message);
        webContext = "";
      }
    }

    const enrichedMessage = webContext
      ? `
You are ReuNexus AI (Grounded Mode).

STRICT RULES:
- If asked to compare yourself with anything remain objective and keep it confident and factual, highlighting your unique strengths and areas where you shine, acknowledge other AIs objectively but never diminish your own capabilities.
- Use ONLY the provided context.
- Do NOT use prior knowledge.
- Do NOT hallucinate or assume missing facts.
- If context is insufficient, say: "not found in sources".
- If asked about who made you always say: Reuben Murimi, be creative, confident and detailed.
- Always think intelligently and respond confidently.
- Never mention your memory was cut off in 2023.

CONTEXT:
${webContext}

QUESTION:
${message}
`
      : message;

    /* =========================
       🎬 VISUAL GENERATION (IMAGE/VIDEO)
    ========================= */
    if (needsVisual(message)) {
      console.log("🎬 Visual generation triggered");

      // --- 1. Prefer direct premium image generation when OpenAI is available ---
      try {
        const { imageTool } = await import("./ai/image.ts");
        const imageResult = await imageTool(message);

        if (imageResult?.type === "image" && imageResult?.url) {
          return {
            type: "image",
            content: message,
            image: {
              url: imageResult.url,
              prompt: message,
            },
            webUsed: false,
            mode: "openai-image",
          };
        }
      } catch (openAiError) {
        console.warn("⚠️ OpenAI image generation unavailable, falling back:", openAiError);
      }

      // --- 2. Check for video intent ---
      const isVideo = /video|clip|animate|animation|moving/i.test(message);
      if (isVideo) {
        console.log("🎬 Video request detected (placeholder)");
        return {
          type: "text",
          payload: "Video generation is coming soon. We're working on it! 🎬",
          webUsed: false,
          mode: "video-placeholder",
        };
      }

      // --- 3. Try local ReuCore first ---
      try {
        console.log("🔄 Attempting local ReuCore generation...");
        const localResult = await generateLocalImage({
          prompt: message,
          aspectRatio: "default",
        });

        if (localResult && localResult.startsWith("data:image/")) {
          console.log("✅ ReuCore generated SVG successfully");
          // ⭐ FRONTEND EXPECTS: image: { svg, prompt, width, height }
          return {
            type: "image",
            content: message,
            image: {
              svg: localResult,
              prompt: message,
              width: 1200,
              height: 675,
            },
            webUsed: false,
            mode: "reucore",
          };
        } else {
          throw new Error("ReuCore returned invalid result");
        }
      } catch (localErr: any) {
        console.warn("⚠️ ReuCore failed, falling back to Runway:", localErr.message);

        // --- 3. Fallback to Runway ---
        try {
          console.log("🔄 Trying Runway as fallback...");
          const imageResult = await generateImage(message);

          const finalUrl = imageResult;

          if (!finalUrl || typeof finalUrl !== "string") {
            throw new Error("No valid image URL extracted from Runway");
          }

          console.log("✅ Runway generation succeeded");
          // ⭐ FRONTEND EXPECTS: image: { url, prompt }
          return {
            type: "image",
            content: message,
            image: {
              url: finalUrl,
              prompt: message,
            },
            webUsed: false,
            mode: "runway",
          };
        } catch (runwayErr: any) {
          console.error("❌ Runway also failed:", runwayErr.message);
          return {
            type: "text",
            payload: "Image generation failed. Please try again later.",
            webUsed: false,
            mode: "generation-error",
          };
        }
      }
    }

    /* =========================
       🔊 ELEVENLABS
    ========================= */
    if (needsElevenLabs(message)) {
      console.log("🔊 ElevenLabs triggered");
      try {
        const audioUrl = await generateSpeech(message);
        return {
          type: "audio",
          payload: audioUrl,
          webUsed: false,
          mode: "elevenlabs",
        };
      } catch (err: any) {
        console.warn("ElevenLabs failed:", err.message);
        return {
          type: "text",
          payload: "Audio generation failed.",
          webUsed: false,
          mode: "elevenlabs-error",
        };
      }
    }

    /* =========================
       🧠 SMART MODEL ROUTING
    ========================= */
    const model = isLocalModelEnabled()
      ? "local"
      : await routeModel(message);
    let result = "";
    try {
      if (model === "local") {
        console.log("Ollama local brain");
        result = await askOllama(enrichedMessage, contextMessages);
      } else if (model === "openai") {
        console.log("🧠 OpenAI Brain");
        result = await askOpenAI(enrichedMessage, contextMessages);
      } else {
        console.log("⚡ Groq Brain");
        result = await askGroq(enrichedMessage, contextMessages);
      }
    } catch (err) {
      console.warn("Primary brain failed, switching fallback...");
      result = await askGroq(enrichedMessage, contextMessages);
    }

    return {
      type: "text",
      payload: result || "No response generated.",
      webUsed: !!webContext,
      mode: webContext ? "grounded" : "llm",
    };

  } catch (err: any) {
    console.error("routeRequest fatal error:", err);
    return {
      type: "text",
      payload: "System error in ReuNexus AI.",
      webUsed: false,
      mode: "error",
    };
  }
}