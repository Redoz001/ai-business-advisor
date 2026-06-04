import { supabase } from "./lib/supabase.js";

/**
 * =========================================
 * REUBEN AI SERVICE
 * Supports:
 * - OpenAI
 * - Groq
 * - Streaming
 * - Error handling
 * - Context memory
 * =========================================
 */

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`;

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
};

/**
 * =========================================
 * SEND MESSAGE TO AI
 * =========================================
 */
export async function sendMessageToAI({
  message,
  userId,
  chatId,
  context = [],
  stream = true,
  provider = "openai", // "openai" | "groq"
  model = "gpt-4o-mini",
}) {
  try {
    /**
     * =========================================
     * REQUEST
     * =========================================
     */
    const response = await fetch(API_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        message,
        userId,
        chatId,
        context,
        stream,
        provider,
        model,
      }),
    });

    /**
     * =========================================
     * HTTP ERROR
     * =========================================
     */
    if (!response.ok) {
      throw new Error(
        `AI request failed with status ${response.status}`
      );
    }

    /**
     * =========================================
     * STREAMING MODE
     * =========================================
     */
    if (stream) {
      if (!response.body) {
        throw new Error("Streaming not supported");
      }

      const reader = response.body.getReader();

      const decoder = new TextDecoder();

      let fullText = "";

      return {
        stream: true,

        async *read() {
          while (true) {
            const { done, value } =
              await reader.read();

            if (done) break;

            const chunk =
              decoder.decode(value, {
                stream: true,
              });

            fullText += chunk;

            yield {
              chunk,
              fullText,
            };
          }

          return fullText;
        },
      };
    }

    /**
     * =========================================
     * NORMAL RESPONSE MODE
     * =========================================
     */
    const data = await response.json();

    if (!data?.reply) {
      throw new Error(
        "Invalid AI response structure"
      );
    }

    return {
      stream: false,
      reply: data.reply,
    };
  } catch (error) {
    /**
     * =========================================
     * ERROR LOGGING
     * =========================================
     */
    console.error(
      "sendMessageToAI ERROR:",
      error
    );

    return {
      stream: false,
      error: true,
      reply:
        "Something went wrong while connecting to ReubenAI.",
      message: error.message,
    };
  }
}

/**
 * =========================================
 * SAVE CHAT MESSAGE
 * =========================================
 */
export async function saveChatMessages({
  chatId,
  userId,
  userMessage,
  aiMessage,
}) {
  try {
    const { error } = await supabase
      .from("chat_messages")
      .insert([
        {
          session_id: chatId,
          user_id: userId,
          role: "user",
          content: userMessage,
        },
        {
          session_id: chatId,
          user_id: userId,
          role: "assistant",
          content: aiMessage,
        },
      ]);

    if (error) throw error;

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "Save messages error:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * =========================================
 * GENERATE CHAT TITLE
 * =========================================
 */
export async function generateChatTitle({
  firstMessage,
  aiReply,
  userId,
  chatId,
}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        mode: "title",

        message: `
Create a short AI chat title.

Rules:
- 3 to 6 words
- No quotes
- No punctuation
- Make it descriptive

User:
${firstMessage}

AI:
${aiReply}

Return only the title.
        `,

        userId,
        chatId,
      }),
    });

    const data = await response.json();

    const title =
      data?.reply?.trim()?.slice(0, 60) ||
      "New Chat";

    /**
     * =========================================
     * UPDATE DATABASE
     * =========================================
     */
    await supabase
      .from("chat_sessions")
      .update({
        title,
      })
      .eq("id", chatId);

    /**
     * =========================================
     * LIVE SIDEBAR UPDATE
     * =========================================
     */
    window.dispatchEvent(
      new CustomEvent(
        "chat-title-update",
        {
          detail: {
            chatId,
            title,
          },
        }
      )
    );

    return title;
  } catch (error) {
    console.error(
      "generateChatTitle ERROR:",
      error
    );

    return "New Chat";
  }
}

/**
 * =========================================
 * TEXT TO SPEECH
 * =========================================
 */
export function speakText(text) {
  try {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    speechSynthesis.speak(utterance);
  } catch (error) {
    console.error(
      "Speech synthesis error:",
      error
    );
  }
}

/**
 * =========================================
 * STOP SPEAKING
 * =========================================
 */
export function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
  } catch (error) {
    console.error(
      "Stop speech error:",
      error
    );
  }
}