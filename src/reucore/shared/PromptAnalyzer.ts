import type {
  EngineRequest,
  EngineTaskType,
} from "../types/Engine";

export type PromptAnalysis = {
  originalPrompt: string;
  normalizedPrompt: string;
  requestedType?: EngineTaskType;
  requestedDurationSeconds?: number;
  requestedAspectRatio?: string;
};

export class PromptAnalyzer {
  analyze(request: EngineRequest): PromptAnalysis {
    const normalizedPrompt = request.prompt
      .trim()
      .replace(/\s+/g, " ");

    return {
      originalPrompt: request.prompt,
      normalizedPrompt,
      requestedType: request.taskType,
      requestedDurationSeconds:
        this.extractDuration(normalizedPrompt),
      requestedAspectRatio:
        this.extractAspectRatio(normalizedPrompt),
    };
  }

  private extractDuration(
    prompt: string
  ): number | undefined {
    const seconds = prompt.match(
      /\b(\d+)\s*(second|seconds|sec)\b/i
    );

    if (seconds) {
      return Number(seconds[1]);
    }

    const minutes = prompt.match(
      /\b(\d+)\s*(minute|minutes|min)\b/i
    );

    if (minutes) {
      return Number(minutes[1]) * 60;
    }

    return undefined;
  }

  private extractAspectRatio(
    prompt: string
  ): string | undefined {
    const explicitRatio = prompt.match(
      /\b(1:1|4:3|3:4|16:9|9:16|21:9)\b/
    );

    if (explicitRatio) {
      return explicitRatio[1];
    }

    if (/\bsquare\b/i.test(prompt)) return "1:1";

    if (/\bportrait|vertical\b/i.test(prompt)) {
      return "9:16";
    }

    if (/\blandscape|widescreen\b/i.test(prompt)) {
      return "16:9";
    }

    return undefined;
  }
}
