import { supabase } from "../../../lib/supabase";

import type {
  ConversationMessage,
  MessageRole,
} from "../types/Message";

import {
  createConversationMessage,
} from "../types/Message";

const API_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`;

const STRUCTURED_PREFIX = "__REUNEXUS_MESSAGE__:";
const FREE_MESH_CACHE_KEY = "reunexus-free-mesh-cache";
const FREE_MESH_CACHE_LIMIT = 100;

type DatabaseMessage = {
  role: MessageRole;
  content: string;
};

export class MessageService {
  static async createChat(
    userId?: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert([
        {
          user_id: userId || null,
          title: "New Chat",
        },
      ])
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data.id;
  }

  static async loadMessages(
    chatId: string
  ): Promise<ConversationMessage[]> {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", chatId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((message) =>
      this.deserializeMessage(
        message.role as MessageRole,
        String(message.content ?? "")
      )
    );
  }

  static async updateChatTitle(
    chatId: string,
    prompt: string
  ): Promise<void> {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("title")
      .eq("id", chatId)
      .single();

    if (error) {
      console.error("Unable to read chat title:", error);
      return;
    }

    if (data?.title !== "New Chat") {
      return;
    }

    const title =
      prompt.length > 50
        ? `${prompt.slice(0, 50)}...`
        : prompt;

    const { error: updateError } = await supabase
      .from("chat_sessions")
      .update({ title })
      .eq("id", chatId);

    if (updateError) {
      console.error(
        "Unable to update chat title:",
        updateError
      );
    }
  }

  static async requestTextResponse(input: {
    message: string;
    chatId: string;
    userId?: string;
    signal?: AbortSignal;
  }): Promise<string> {
    const cacheKey = this.freeMeshKey(input.chatId, input.message);
    const cachedResponse = this.readFreeMeshCache(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (import.meta.env.VITE_LOCAL_AI === "true") {
      const baseUrl = (import.meta.env.VITE_OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
      const model = import.meta.env.VITE_OLLAMA_MODEL || "llama3";
      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          signal: input.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            stream: false,
            messages: [{ role: "user", content: input.message }],
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Local Ollama request failed.");
        }

        const content = String(result?.message?.content || "");
        this.writeFreeMeshCache(cacheKey, content);
        return content;
      } catch (error) {
        if (import.meta.env.VITE_LOCAL_AI_ONLY === "true") {
          throw error;
        }
        console.warn("Ollama unavailable; using hosted AI fallback.");
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(API_URL, {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? {
              Authorization:
                `Bearer ${session.access_token}`,
            }
          : {}),
      },
      body: JSON.stringify({
        message: input.message,
        chatId: input.chatId,
        userId: input.userId || "anon",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        errorText ||
          `Request failed with status ${response.status}.`
      );
    }

    const raw = await response.text();

    if (!raw) {
      return "";
    }

    try {
      const result = JSON.parse(raw);
      const content = String(result?.payload ?? "");
      this.writeFreeMeshCache(cacheKey, content);
      return content;
    } catch {
      this.writeFreeMeshCache(cacheKey, raw);
      return raw;
    }
  }

  /**
   * Stream an assistant reply token-by-token using SSE.
   * Calls onDelta as each chunk arrives and returns the full text.
   *
   * Safe by design:
   * - If the backend does not support streaming (old deployment, non-2xx,
   *   or a non-SSE body), it transparently falls back to the classic
   *   JSON response from requestTextResponse so chat never breaks.
   * - Pass-through signal abort / cancellation is respected.
   */
  static async streamTextResponse(
    input: {
      message: string;
      chatId: string;
      userId?: string;
      signal?: AbortSignal;
    },
    onDelta?: (delta: string, full: string) => void
  ): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const controller = new AbortController();

    const abortListener = () => controller.abort();
    input.signal?.addEventListener("abort", abortListener);

    let full = "";

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? {
                Authorization: `Bearer ${session.access_token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          message: input.message,
          chatId: input.chatId,
          userId: input.userId || "anon",
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream request failed with status ${response.status}.`);
      }

      const contentType = response.headers.get("Content-Type") || "";

      // Backend did not honor streaming → fall back to classic JSON.
      if (!contentType.includes("text/event-stream")) {
        const raw = await response.text();

        let content = "";
        try {
          const json = JSON.parse(raw);
          content = String(json?.payload ?? "");
        } catch {
          content = raw;
        }

        if (!content) {
          throw new Error("Empty response from AI.");
        }

        full = content;
        onDelta?.(full, full);
        return full;
      }

      if (!response.body) {
        throw new Error("Streaming not supported by this network layer.");
      }

      const reader = response.body.getReader();

      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary: number;

        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, boundary);

          buffer = buffer.slice(boundary + 2);

          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;

            const payload = line.slice(5).trim();

            if (!payload) continue;

            try {
              const data = JSON.parse(payload);

              if (data?.done === true) {
                return full;
              }

              if (data?.error) {
                throw new Error(data.error);
              }

              const delta = String(data?.delta ?? "");

              if (delta) {
                full += delta;
                onDelta?.(delta, full);
              }
            } catch {
              // Ignore keep-alive / malformed frames.
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      // Streaming path failed for any reason — degrade gracefully to the
      // battle-tested JSON endpoint so the user still gets an answer.
      console.warn("Streaming unavailable, falling back:", error instanceof Error ? error.message : error);

      const fallback = await this.requestTextResponse({
        message: input.message,
        chatId: input.chatId,
        userId: input.userId,
      });

      full = fallback;
      onDelta?.(fallback, fallback);
    } finally {
      input.signal?.removeEventListener("abort", abortListener);
    }

    return full;
  }

  private static freeMeshKey(chatId: string, message: string): string {
    return `${chatId}:${message.trim().toLowerCase().replace(/\s+/g, " ")}`;
  }

  private static readFreeMeshCache(key: string): string | null {
    if (import.meta.env.VITE_FREE_MESH !== "true" || typeof localStorage === "undefined") {
      return null;
    }

    try {
      const cache = JSON.parse(localStorage.getItem(FREE_MESH_CACHE_KEY) || "{}");
      return typeof cache[key]?.content === "string" ? cache[key].content : null;
    } catch {
      return null;
    }
  }

  private static writeFreeMeshCache(key: string, content: string): void {
    if (import.meta.env.VITE_FREE_MESH !== "true" || !content || typeof localStorage === "undefined") {
      return;
    }

    try {
      const cache = JSON.parse(localStorage.getItem(FREE_MESH_CACHE_KEY) || "{}");
      cache[key] = { content, savedAt: Date.now() };
      const entries = Object.entries(cache).slice(-FREE_MESH_CACHE_LIMIT);
      localStorage.setItem(FREE_MESH_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      localStorage.removeItem(FREE_MESH_CACHE_KEY);
    }
  }

  static async saveMessages(
    chatId: string,
    messages: ConversationMessage[]
  ): Promise<void> {
    if (!messages.length) return;

    const rows = messages.map((message) => ({
      session_id: chatId,
      role: message.role,
      content: this.serializeMessage(message),
    }));

    const { error } = await supabase
      .from("chat_messages")
      .insert(rows);

    if (error) {
      throw new Error(error.message);
    }
  }

  private static serializeMessage(
    message: ConversationMessage
  ): string {
    if (
      message.type === "text" &&
      !message.image &&
      !message.video &&
      !message.metadata
    ) {
      return message.content;
    }

    return (
      STRUCTURED_PREFIX +
      JSON.stringify({
        type: message.type,
        content: message.content,
        image: message.image,
        video: message.video,
        metadata: message.metadata,
      })
    );
  }

  private static deserializeMessage(
    role: MessageRole,
    storedContent: string
  ): ConversationMessage {
    if (!storedContent.startsWith(STRUCTURED_PREFIX)) {
      return createConversationMessage(
        role,
        storedContent,
        {
          type: "text",
        }
      );
    }

    try {
      const parsed = JSON.parse(
        storedContent.slice(STRUCTURED_PREFIX.length)
      );

      return createConversationMessage(
        role,
        String(parsed?.content ?? ""),
        {
          type: parsed?.type ?? "text",
          image: parsed?.image,
          video: parsed?.video,
          metadata: parsed?.metadata,
        }
      );
    } catch {
      return createConversationMessage(
        role,
        storedContent,
        {
          type: "text",
        }
      );
    }
  }
}
