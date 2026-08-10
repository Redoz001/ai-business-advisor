import { BaseEngine } from "../engines/BaseEngine";
import { ResponseFactory } from "../shared/ResponseFactory";

import type {
  EngineRequest,
  EngineResponse,
} from "../types/Engine";

export class ImageEngine extends BaseEngine {
  readonly name = "image-engine";
  readonly type = "image" as const;

  async execute(
    request: EngineRequest
  ): Promise<EngineResponse> {
    const prompt =
      this.validatePrompt(request);

    return ResponseFactory.image({
      prompt,
      metadata: {
        status: "ready-for-renderer",
      },
    });
  }
}
