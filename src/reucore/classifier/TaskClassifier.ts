import type {
  EngineRequest,
  EngineTaskType,
} from "../types/Engine";

export type ClassificationResult = {
  type: EngineTaskType;
  confidence: number;
};

const IMAGE_PATTERN =
  /\b(create|generate|draw|design|make|render)\b.*\b(image|picture|photo|logo|poster|thumbnail|illustration|artwork|graphic)\b/i;

const VIDEO_PATTERN =
  /\b(create|generate|make|render|produce|animate)\b.*\b(video|animation|clip|trailer|commercial)\b/i;

const CODE_PATTERN =
  /\b(code|function|script|component|typescript|javascript|python|react|html|css|sql|debug|refactor)\b/i;

const DOCUMENT_PATTERN =
  /\b(pdf|document|report|contract|resume|cv|file)\b/i;

export class TaskClassifier {
  classify(
    request: EngineRequest | string
  ): ClassificationResult {
    const prompt =
      typeof request === "string"
        ? request.trim()
        : request.prompt.trim();

    if (!prompt) {
      return {
        type: "unknown",
        confidence: 0,
      };
    }

    if (VIDEO_PATTERN.test(prompt)) {
      return {
        type: "video",
        confidence: 0.94,
      };
    }

    if (IMAGE_PATTERN.test(prompt)) {
      return {
        type: "image",
        confidence: 0.93,
      };
    }

    if (CODE_PATTERN.test(prompt)) {
      return {
        type: "code",
        confidence: 0.82,
      };
    }

    if (DOCUMENT_PATTERN.test(prompt)) {
      return {
        type: "document",
        confidence: 0.78,
      };
    }

    return {
      type: "text",
      confidence: 0.65,
    };
  }
}
