// src/features/conversation/types/Message.ts

export type MessageRole = "user" | "assistant" | "system";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "code"
  | "document"
  | "system";

export type MessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "error";

export type ConversationMessage = {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  createdAt: number;
  status?: MessageStatus;

  // 👇 ADD THIS: to handle backend responses with payload
  payload?: string | any;

  image?: {
    url?: string;
    svg?: string;
    prompt?: string;
    width?: number;
    height?: number;
    mimeType?: string;
  };

  video?: {
    url?: string;
    thumbnailUrl?: string;
    prompt?: string;
    durationSeconds?: number;
    mimeType?: string;
  };

  metadata?: Record<string, unknown>;
};

export function createConversationMessage(
  role: MessageRole,
  content: string,
  options: Partial<Omit<ConversationMessage, "id" | "role" | "content" | "createdAt">> = {}
): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role,
    type: options.type ?? "text",
    content,
    createdAt: Date.now(),
    status: options.status ?? "complete",
    ...options,
  };
}