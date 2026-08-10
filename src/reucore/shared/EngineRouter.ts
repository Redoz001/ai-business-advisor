import { TaskClassifier } from "../classifier/TaskClassifier";
import { TextEngine } from "../engines/TextEngine";
import { ImageEngine } from "../image/ImageEngine";
import { VideoEngine } from "../video/VideoEngine";
import { ResponseFactory } from "./ResponseFactory";

import type {
  EngineRequest,
  EngineResponse,
  EngineTaskType,
  ReuEngine,
} from "../types/Engine";

export class EngineRouter {
  private readonly classifier =
    new TaskClassifier();

  private readonly engines =
    new Map<EngineTaskType, ReuEngine>();

  constructor() {
    this.register(new TextEngine());
    this.register(new ImageEngine());
    this.register(new VideoEngine());
  }

  register(engine: ReuEngine): void {
    this.engines.set(
      engine.type,
      engine
    );
  }

  async route(
    request: EngineRequest
  ): Promise<EngineResponse> {
    const classification =
      request.taskType
        ? {
            type: request.taskType,
            confidence: 1,
          }
        : this.classifier.classify(request);

    const routedRequest: EngineRequest = {
      ...request,
      taskType: classification.type,
      metadata: {
        ...request.metadata,
        classificationConfidence:
          classification.confidence,
      },
    };

    const engine =
      this.engines.get(
        classification.type
      );

    if (!engine) {
      return ResponseFactory.failure(
        classification.type,
        `No engine is registered for "${classification.type}".`
      );
    }

    try {
      return await engine.execute(
        routedRequest
      );
    } catch (error) {
      return ResponseFactory.failure(
        classification.type,
        error instanceof Error
          ? error.message
          : "The engine failed unexpectedly."
      );
    }
  }
}
