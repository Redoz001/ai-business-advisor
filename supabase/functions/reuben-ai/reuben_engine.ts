// Providers are imported lazily below to avoid crashing the function
// at module load time when environment secrets are missing.

import {
  getMemory,
  saveMemory,
  saveFeedback,
  extractLearning
} from "./ai/memory.ts";

    /* =========================
       🎬 VISUAL GENERATION (IMAGE/VIDEO)
    ========================= */
    if (needsVisual(message)) {
      console.log("🎬 Visual generation triggered (lazy providers)");

      // --- 1. Check for video intent ---
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

      // --- 2. Try local ReuCore first (lazy import) ---
      try {
        console.log("🔄 Attempting local ReuCore generation (lazy import)...");
        const mod = await import("./providers/reucore.ts");
        const generateLocalImage = mod.generateLocalImage || mod.default || mod;
        const localResult = await generateLocalImage({
          prompt: message,
          aspectRatio: "default",
        });

        if (localResult && typeof localResult === "string" && localResult.startsWith("data:image/")) {
          console.log("✅ ReuCore generated SVG successfully");
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
        }

        throw new Error("ReuCore returned invalid result");
      } catch (localErr: any) {
        console.warn("⚠️ ReuCore failed or not available, falling back to Runway:", localErr?.message ?? localErr);

        // --- 3. Fallback to Runway (lazy) ---
        try {
          console.log("🔄 Trying Runway as fallback (lazy import)...");
          const runway = await import("./providers/runway.ts");
          const generateImage = runway.generateImage || runway.default || runway;
          const imageResult = await generateImage(message);

          const finalUrl =
            typeof imageResult === "string"
              ? imageResult
              : imageResult?.output_url ||
                imageResult?.url ||
                imageResult?.payload ||
                (Array.isArray(imageResult?.output) ? imageResult.output[0] : null) ||
                (Array.isArray(imageResult?.result) ? imageResult.result[0] : null);

          if (!finalUrl || typeof finalUrl !== "string") {
            throw new Error("No valid image URL extracted from Runway");
          }

          console.log("✅ Runway generation succeeded");
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
          console.error("❌ Runway also failed or is not configured:", runwayErr?.message ?? runwayErr);
          return {
            type: "text",
            payload: "Image generation failed. Please try again later.",
            webUsed: false,
            mode: "generation-error",
          };
        }
      }
    }
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
      console.log("🌐 Tavily search triggered (lazy)");
      try {
        const mod = await import("./providers/tavily.ts");
        const searchFn = mod.searchTavily || mod.default || mod;
        const search = await searchFn(message);
        webContext =
          search?.answer ||
          search?.results?.map((r: any) => r.content).join("\n") ||
          "";
      } catch (err: any) {
        console.warn("Tavily failed or not configured:", err?.message ?? err);
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

      // --- 1. Check for video intent ---
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

      // --- 2. Try local ReuCore first ---
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

          const finalUrl =
            typeof imageResult === "string"
              ? imageResult
              : imageResult?.output_url ||
                imageResult?.url ||
                imageResult?.payload ||
                (Array.isArray(imageResult?.output) ? imageResult.output[0] : null) ||
                (Array.isArray(imageResult?.result) ? imageResult.result[0] : null);

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
        const mod = await import("./providers/elevenlabs.ts");
        const generateSpeech = mod.generateSpeech || mod.default || mod;
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
    const model = await routeModel(message);
    let result = "";
    try {
      if (model === "openai") {
        console.log("🧠 OpenAI Brain (lazy)");
        const mod = await import("./providers/openai.ts");
        const askOpenAI = mod.askOpenAI || mod.default || mod;
        result = await askOpenAI(enrichedMessage, contextMessages);
      } else {
        console.log("⚡ Groq Brain (lazy)");
        const mod = await import("./providers/groq.ts");
        const askGroq = mod.askGroq || mod.default || mod;
        result = await askGroq(enrichedMessage, contextMessages);
      }
    } catch (err) {
      console.warn("Primary brain failed or provider unavailable, switching fallback...", err?.message ?? err);
      try {
        const mod = await import("./providers/groq.ts");
        const askGroq = mod.askGroq || mod.default || mod;
        result = await askGroq(enrichedMessage, contextMessages);
      } catch (fallbackErr: any) {
        console.error("Fallback Groq also failed:", fallbackErr?.message ?? fallbackErr);
        result = "";
      }
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