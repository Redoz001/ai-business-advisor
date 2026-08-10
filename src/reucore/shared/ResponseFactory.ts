import type {
  EngineResponse,
  EngineTaskType,
} from "../types/Engine";

export class ResponseFactory {
  static text(
    content: string,
    metadata?: Record<string, unknown>
  ): EngineResponse {
    return {
      success: true,
      type: "text",
      content,
      metadata,
    };
  }

  static image(input: {
    prompt: string;
    svg?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }): EngineResponse {
    return {
      success: true,
      type: "image",
      content: "Image generation completed.",
      image: {
        prompt: input.prompt,
        svg: input.svg,
        url: input.url,
      },
      metadata: input.metadata,
    };
  }

  static video(input: {
    prompt: string;
    url?: string;
    durationSeconds?: number;
    metadata?: Record<string, unknown>;
  }): EngineResponse {
    return {
      success: true,
      type: "video",
      content: "Video generation completed.",
      video: {
        prompt: input.prompt,
        url: input.url,
        durationSeconds:
          input.durationSeconds,
      },
      metadata: input.metadata,
    };
  }

  static failure(
    type: EngineTaskType,
    error: string
  ): EngineResponse {
    return {
      success: false,
      type,
      error,
    };
  }
}
