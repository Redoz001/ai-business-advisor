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
      return String(result?.payload ?? "");
    } catch {
      return raw;
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
