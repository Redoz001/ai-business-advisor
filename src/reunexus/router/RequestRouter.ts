import { IntentAnalyzer } from "../intent/IntentAnalyzer";

import type {
  IntentContext,
  ReuNexusIntent,
} from "../intent/IntentTypes";

import type {
  RouteResult,
  RouteTarget,
} from "./RouteResult";

const TARGETS: Record<ReuNexusIntent, RouteTarget> = {
  text: "text-engine",
  image: "image-engine",
  "image-edit": "image-engine",
  video: "video-engine",
  "video-edit": "video-engine",
  code: "code-engine",
  document: "document-engine",
  unknown: "clarification",
};

export class RequestRouter {
  private readonly analyzer: IntentAnalyzer;

  constructor(analyzer = new IntentAnalyzer()) {
    this.analyzer = analyzer;
  }

  route(
    prompt: string,
    context: IntentContext = {}
  ): RouteResult {
    const result = this.analyzer.analyze(prompt, context);

    if (result.requiresClarification) {
      return {
        target: "clarification",
        intent: result.intent,
        confidence: result.confidence,
        prompt: result.normalizedPrompt,
        clarificationQuestion:
          result.clarificationQuestion ??
          "Could you clarify what you want ReuNexus to create?",
        metadata: result.metadata,
      };
    }

    return {
      target: TARGETS[result.intent],
      intent: result.intent,
      confidence: result.confidence,
      prompt: result.normalizedPrompt,
      metadata: result.metadata,
    };
  }
}
