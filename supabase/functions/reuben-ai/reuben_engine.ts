import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  getConversationHistory,
  getLongTermMemory,
  saveMessage,
} from "./memory.ts";

import { embed } from "./embeddings.ts";

import {
  retrieveRAG,
} from "./rag.ts";

import { runTools } from "./tools.ts";

import { routeRequest } from "./router.ts";

import {
  buildSystemPrompt,
  buildMessages,
} from "./prompt.ts";

/* =========================================================
   ENV
========================================================= */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY"
);

const GROQ_KEY = Deno.env.get(
  "GROQ_API_KEY"
);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase environment variables"
  );
}

if (!GROQ_KEY) {
  throw new Error(
    "Missing GROQ_API_KEY"
  );
}

createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =========================================================
   CONFIG
========================================================= */

const MODEL =
  "llama-3.3-70b-versatile";

const TEMPERATURE = 0.7;

const TIMEOUT_MS = 30000;

/* =========================================================
   GROQ
========================================================= */

async function callGroq(
  messages: any[]
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        signal: controller.signal,

        headers: {
          Authorization:
            `Bearer ${GROQ_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model: MODEL,
          temperature: TEMPERATURE,
          messages,
        }),
      }
    );

    const raw =
      await response.text();

    if (!response.ok) {
      console.error(
        "Groq Error:",
        raw
      );

      throw new Error(
        `Groq request failed (${response.status})`
      );
    }

    const data = JSON.parse(raw);

    const reply =
      data?.choices?.[0]?.message
        ?.content;

    if (!reply) {
      throw new Error(
        "No model response"
      );
    }

    return reply;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   MAIN ENGINE
========================================================= */

export async function runReubenAI({
  message,
  userId,
  chatId,
}: {
  message: string;
  userId: string;
  chatId: string;
}) {
  const started =
    performance.now();

  if (!message?.trim()) {
    throw new Error(
      "Message is required"
    );
  }

  /* =====================================================
     SAVE USER MESSAGE
  ===================================================== */

  await saveMessage(
    chatId,
    userId,
    "user",
    message
  );

  /* =====================================================
     ROUTER
  ===================================================== */

  const route =
    routeRequest(message);

  /* =====================================================
     LOAD MEMORY
  ===================================================== */

  const [
    history,
    longMemory,
  ] = await Promise.all([
    getConversationHistory(
      chatId
    ),

    getLongTermMemory(
      userId
    ),
  ]);

  /* =====================================================
     TOOLS
  ===================================================== */

  let toolContext = "";

  try {
    const toolResult =
      await runTools(message);

    if (toolResult) {
      toolContext =
        JSON.stringify(
          toolResult,
          null,
          2
        );
    }
  } catch (err) {
    console.error(
      "Tool Error:",
      err
    );
  }

  /* =====================================================
     RAG
  ===================================================== */

  let ragContext = "";

  try {
    const vector =
      await embed(message);

    const rag =
      await retrieveRAG(
        vector
      );

    ragContext =
      rag.combinedContext;
  } catch (err) {
    console.error(
      "RAG Error:",
      err
    );
  }

  /* =====================================================
     PROMPT
  ===================================================== */

  const systemPrompt =
    buildSystemPrompt({
      memory: longMemory,
      ragContext,
      toolContext,
      mode:
        route.mode ??
        "chat",
    });

  const messages =
    buildMessages({
      systemPrompt,
      history,
      userMessage:
        message,
    });

  /* =====================================================
     GENERATION
  ===================================================== */

  const reply =
    await callGroq(
      messages
    );

  /* =====================================================
     SAVE ASSISTANT
  ===================================================== */

  await saveMessage(
    chatId,
    userId,
    "assistant",
    reply
  );

  /* =====================================================
     DIAGNOSTICS
  ===================================================== */

  const latencyMs =
    Math.round(
      performance.now() -
        started
    );

  return {
    reply,

    diagnostics: {
      model: MODEL,

      latencyMs,

      route:
        route.mode,

      historyMessages:
        history.length,

      ragUsed:
        Boolean(
          ragContext
        ),

      toolUsed:
        Boolean(
          toolContext
        ),
    },
  };
}