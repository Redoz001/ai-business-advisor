export type EngineTaskType =
  | "text"
  | "image"
  | "video"
  | "code"
  | "document"
  | "unknown";

export type EngineRequest = {
  prompt: string;
  taskType?: EngineTaskType;
  userId?: string;
  chatId?: string;
  metadata?: Record<string, unknown>;
};

export type EngineResponse = {
  success: boolean;
  type: EngineTaskType;
  content?: string;
  image?: {
    svg?: string;
    url?: string;
    prompt: string;
  };
  video?: {
    url?: string;
    prompt: string;
    durationSeconds?: number;
  };
  metadata?: Record<string, unknown>;
  error?: string;
};

export interface ReuEngine {
  readonly name: string;
  readonly type: EngineTaskType;

  canHandle(request: EngineRequest): boolean;

  execute(
    request: EngineRequest
  ): Promise<EngineResponse>;
}
