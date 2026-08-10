import { BaseEngine } from "./BaseEngine";
import { ResponseFactory } from "../shared/ResponseFactory";

import type {
  EngineRequest,
  EngineResponse,
} from "../types/Engine";

export class TextEngine extends BaseEngine {
  readonly name = "text-engine";
  readonly type = "text" as const;

  async execute(
    request: EngineRequest
  ): Promise<EngineResponse> {
    const prompt =
      this.validatePrompt(request);

    return ResponseFactory.text(
      prompt,
      {
        delegated: true,
        note:
          "The existing ReuNexus Edge Function handles the final text response.",
      }
    );
  }
}
