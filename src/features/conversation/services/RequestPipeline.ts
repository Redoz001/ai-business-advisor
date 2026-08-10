// src/features/conversation/services/RequestPipeline.ts

import { createClient } from "@supabase/supabase-js";
import { generateVisual } from "../../../services/reucore";
import type {
  ConversationMessage,
  MessageType,
} from "../types/Message";

export type PipelineRequest = {
  prompt: string;
  chatId: string;
  userId?: string;
  messages: ConversationMessage[];
  signal?: AbortSignal;
};

export type PipelineResponse = {
  type: MessageType;
  content: string;
  image?: ConversationMessage["image"];
  video?: ConversationMessage["video"];
  metadata?: Record<string, unknown>;
  shouldStream: boolean;
};

type TextResponseRequester = (input: {
  message: string;
  chatId: string;
  userId?: string;
  signal?: AbortSignal;
}) => Promise<string>;

export class RequestPipeline {
  private supabase: any;

  constructor(supabaseClient?: any) {
    this.supabase =
      supabaseClient ||
      createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
  }

  async execute(
    request: PipelineRequest,
    requestTextResponse: TextResponseRequester
  ): Promise<PipelineResponse> {
    const { prompt, chatId, userId, signal, messages } = request;

    // ---- DETECT VISUAL INTENT ----
    const isVisual = this.isVisualRequest(prompt);

    // ---- IF VISUAL → LOCAL FIRST, THEN EDGE FUNCTION ----
    if (isVisual) {
      const wantsVideo = /\b(video|animate|animation)\b/i.test(prompt);
      const wantsHighQuality = /\b(photo|photorealistic|high[- ]?quality|best|realistic|4k|8k|ultra)\b/i.test(prompt);
      const useLocalVisual = import.meta.env.VITE_DISABLE_LOCAL_VISUAL !== "true";

      if (useLocalVisual) {
        try {
          const local = await generateVisual({
            prompt,
            outputType: wantsVideo ? "video" : "image",
            quality: wantsHighQuality ? "high" : "standard",
          });

          if (local.success) {
            if (wantsVideo && local.video?.url) {
              return {
                type: "video",
                content: "Generated video",
                video: {
                  url: local.video.url,
                  mimeType: local.video.mimeType,
                  durationSeconds: local.video.duration,
                },
                metadata: { mode: "reucore-local" },
                shouldStream: false,
              };
            }

            if (!wantsVideo && (local.svg || local.url)) {
              return {
                type: "image",
                content: prompt,
                image: {
                  svg: local.svg,
                  url: local.url,
                  width: local.width,
                  height: local.height,
                  prompt,
                },
                metadata: { mode: "reucore-local" },
                shouldStream: false,
              };
            }
          }
        } catch (err) {
          console.error("Local visual generation failed:", err);
          // fall through to edge function
        }
      }
      try {
        const response = await this.callEdgeFunction({
          message: prompt,
          chatId,
          userId,
          signal,
          history: messages,
        });

        if (response?.type === "image" && response?.image) {
          return {
            type: "image",
            content: response.content || prompt,
            image: response.image,
            metadata: response.metadata || { mode: response.mode || "reucore" },
            shouldStream: false,
          };
        }

        if (response?.type === "video") {
          return {
            type: "video",
            content: response.content || "Video generation in progress...",
            video: response.video,
            metadata: response.metadata || { mode: "video" },
            shouldStream: false,
          };
        }

        // If Edge Function returns text (error or fallback)
        if (response?.type === "text" && response?.content) {
          return {
            type: "text",
            content: response.content,
            metadata: response.metadata || { mode: "fallback" },
            shouldStream: false,
          };
        }

        return {
          type: "text",
          content: "Unable to process your request.",
          metadata: { mode: "error" },
          shouldStream: false,
        };
      } catch (error) {
        console.error("Edge Function error:", error);
        return {
          type: "text",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          metadata: { mode: "error" },
          shouldStream: false,
        };
      }
    }

    // ---- TEXT REQUEST → USE LLM ----
    try {
      const content = await requestTextResponse({
        message: prompt,
        chatId,
        userId,
        signal,
      });

      return {
        type: "text",
        content,
        metadata: { mode: "llm" },
        shouldStream: true,
      };
    } catch (error) {
      console.error("Text response error:", error);
      return {
        type: "text",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: { mode: "error" },
        shouldStream: false,
      };
    }
  }

  // ---- DETECTION ----
  private isVisualRequest(prompt: string): boolean {
    const msg = prompt.toLowerCase().trim();
    return (
      msg.includes("image") ||
      msg.includes("picture") ||
      msg.includes("draw") ||
      msg.includes("render") ||
      msg.includes("photo") ||
      msg.includes("generate") ||
      msg.includes("create") ||
      msg.includes("make") ||
      msg.includes("show me") ||
      msg.includes("video") ||
      msg.includes("animate")
    );
  }

  // ---- CALL EDGE FUNCTION ----
  private async callEdgeFunction(input: {
    message: string;
    chatId: string;
    userId?: string;
    signal?: AbortSignal;
    history?: ConversationMessage[];
  }): Promise<any> {
    const payload = {
      message: input.message,
      chatId: input.chatId,
      userId: input.userId,
      sessionHistory: input.history?.map((msg) => ({
        role: msg.role,
        content: msg.content,
        type: msg.type,
      })),
    };

    const { data, error } = await this.supabase.functions.invoke("reuben-ai", {
      body: payload,
      signal: input.signal,
    });

    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }

    return data;
  }
}