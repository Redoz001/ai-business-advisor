import { BaseEngine } from "../engines/BaseEngine";
import { ResponseFactory } from "../shared/ResponseFactory";

import type {
  EngineRequest,
  EngineResponse,
} from "../types/Engine";

export class VideoEngine extends BaseEngine {
  readonly name = "video-engine";
  readonly type = "video" as const;

  async execute(
    request: EngineRequest
  ): Promise<EngineResponse> {
    const prompt =
      this.validatePrompt(request);

    return ResponseFactory.video({
      prompt,
      durationSeconds:
        typeof request.metadata?.durationSeconds ===
        "number"
          ? request.metadata.durationSeconds
          : undefined,
      metadata: {
        status: "ready-for-renderer",
      },
    });
  }
}
