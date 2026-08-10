import type {
  ConversationMessage,
  IntentContext,
  ReuNexusIntent,
} from "./IntentTypes";

import type { IntentResult } from "./IntentResult";

type ScoredIntent = {
  intent: ReuNexusIntent;
  score: number;
  source:
    | "explicit-command"
    | "rule"
    | "conversation-context"
    | "fallback";
};

const IMAGE_CREATION_PATTERNS = [
  /\b(generate|create|make|draw|design|produce|render)\b.*\b(image|picture|photo|illustration|poster|logo|thumbnail|wallpaper|artwork|graphic)\b/i,
  /\b(image|picture|photo|illustration|poster|logo|thumbnail|wallpaper|artwork|graphic)\b.*\b(of|for|showing|with)\b/i,
  /\bvisualize\b/i,
  /\bdraw me\b/i,
  /\bmake me a logo\b/i,
];

const VIDEO_CREATION_PATTERNS = [
  /\b(generate|create|make|produce|render)\b.*\b(video|animation|clip|trailer|commercial|advertisement|ad)\b/i,
  /\banimate\b.*\b(image|picture|scene|logo|it|this)\b/i,
  /\bturn\b.*\binto a video\b/i,
  /\b\d+\s*(second|seconds|sec|minute|minutes|min)\b.*\b(video|clip|animation)\b/i,
];

const IMAGE_EDIT_PATTERNS = [
  /\b(edit|modify|change|adjust|enhance|improve|retouch|remove|replace|crop|resize|recolor|brighten|darken)\b.*\b(image|picture|photo|logo|poster|thumbnail|it|this)\b/i,
  /\bmake (it|this image|the image)\b.*\b(brighter|darker|clearer|blue|red|transparent|realistic|cinematic)\b/i,
  /\bremove the background\b/i,
];

const VIDEO_EDIT_PATTERNS = [
  /\b(edit|modify|trim|cut|extend|shorten|enhance|caption|subtitle)\b.*\b(video|clip|animation|it|this)\b/i,
  /\badd music\b.*\b(video|clip|it|this)\b/i,
];

const CODE_PATTERNS = [
  /\b(write|create|generate|fix|debug|refactor|explain)\b.*\b(code|function|component|script|program|api|typescript|javascript|python|react|css|html|sql)\b/i,
  /\b(error|exception|stack trace|compile|build failed)\b/i,
];

const DOCUMENT_PATTERNS = [
  /\b(summarize|review|analyze|extract|read|explain)\b.*\b(pdf|document|file|report|contract|cv|resume|letter)\b/i,
  /\bfrom this (file|document|pdf)\b/i,
];

const TEXT_PATTERNS = [
  /^(what|why|when|where|who|how|can|could|should|would|is|are|do|does|tell|explain|help)\b/i,
  /\b(explain|describe|answer|teach|compare|recommend|advise)\b/i,
];

export class IntentAnalyzer {
  analyze(
    prompt: string,
    context: IntentContext = {}
  ): IntentResult {
    const originalPrompt = prompt;
    const normalizedPrompt = this.normalize(prompt);

    if (!normalizedPrompt) {
      return this.createResult({
        intent: "unknown",
        confidence: 0,
        source: "fallback",
        originalPrompt,
        normalizedPrompt,
        requiresClarification: true,
        clarificationQuestion: "What would you like ReuNexus to create or help you with?",
        context,
      });
    }

    const explicit = this.detectExplicitCommand(normalizedPrompt);

    if (explicit) {
      return this.createResult({
        ...explicit,
        originalPrompt,
        normalizedPrompt,
        requiresClarification: false,
        context,
      });
    }

    const scores: ScoredIntent[] = [];

    this.scorePatterns(
      scores,
      normalizedPrompt,
      "image-edit",
      IMAGE_EDIT_PATTERNS,
      0.93
    );

    this.scorePatterns(
      scores,
      normalizedPrompt,
      "video-edit",
      VIDEO_EDIT_PATTERNS,
      0.93
    );

    this.scorePatterns(
      scores,
      normalizedPrompt,
      "video",
      VIDEO_CREATION_PATTERNS,
      0.9
    );

    this.scorePatterns(
      scores,
      normalizedPrompt,
      "image",
      IMAGE_CREATION_PATTERNS,
      0.89
    );

    this.scorePatterns(
      scores,
      normalizedPrompt,
      "code",
      CODE_PATTERNS,
      0.84
    );

    this.scorePatterns(
      scores,
      normalizedPrompt,
      "document",
      DOCUMENT_PATTERNS,
      0.86
    );

    this.scorePatterns(
      scores,
      normalizedPrompt,
      "text",
      TEXT_PATTERNS,
      0.7
    );

    const contextualIntent = this.detectFromContext(
      normalizedPrompt,
      context.messages ?? [],
      context
    );

    if (contextualIntent) {
      scores.push(contextualIntent);
    }

    const best = scores.sort((a, b) => b.score - a.score)[0];

    if (!best) {
      return this.createResult({
        intent: "text",
        confidence: 0.55,
        source: "fallback",
        originalPrompt,
        normalizedPrompt,
        requiresClarification: false,
        context,
      });
    }

    const competing = scores.find(
      (candidate) =>
        candidate.intent !== best.intent &&
        Math.abs(candidate.score - best.score) < 0.08
    );

    const requiresClarification =
      best.score < 0.6 || Boolean(competing);

    return this.createResult({
      intent: best.intent,
      confidence: best.score,
      source: best.source,
      originalPrompt,
      normalizedPrompt,
      requiresClarification,
      clarificationQuestion: requiresClarification
        ? this.getClarificationQuestion(best.intent, competing?.intent)
        : undefined,
      context,
    });
  }

  private normalize(prompt: string): string {
    return prompt
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
  }

  private detectExplicitCommand(
    prompt: string
  ): Pick<
    IntentResult,
    "intent" | "confidence" | "source"
  > | null {
    const commands: Array<{
      prefixes: string[];
      intent: ReuNexusIntent;
    }> = [
      {
        prefixes: ["/image", "/img", "image:"],
        intent: "image",
      },
      {
        prefixes: ["/video", "video:"],
        intent: "video",
      },
      {
        prefixes: ["/code", "code:"],
        intent: "code",
      },
      {
        prefixes: ["/document", "/doc", "document:"],
        intent: "document",
      },
    ];

    const lower = prompt.toLowerCase();

    for (const command of commands) {
      if (
        command.prefixes.some((prefix) =>
          lower.startsWith(prefix)
        )
      ) {
        return {
          intent: command.intent,
          confidence: 1,
          source: "explicit-command",
        };
      }
    }

    return null;
  }

  private scorePatterns(
    target: ScoredIntent[],
    prompt: string,
    intent: ReuNexusIntent,
    patterns: RegExp[],
    baseScore: number
  ) {
    const matches = patterns.filter((pattern) =>
      pattern.test(prompt)
    ).length;

    if (matches === 0) return;

    target.push({
      intent,
      score: Math.min(baseScore + (matches - 1) * 0.03, 0.99),
      source: "rule",
    });
  }

  private detectFromContext(
    prompt: string,
    messages: ConversationMessage[],
    context: IntentContext
  ): ScoredIntent | null {
    const followUpPattern =
      /^(make|change|turn|animate|edit|improve|add|remove|replace|continue|shorten|extend)\b/i;

    if (!followUpPattern.test(prompt)) {
      return null;
    }

    if (context.hasImageAttachment) {
      return {
        intent: /animate|video/i.test(prompt)
          ? "video"
          : "image-edit",
        score: 0.91,
        source: "conversation-context",
      };
    }

    if (context.hasVideoAttachment) {
      return {
        intent: "video-edit",
        score: 0.91,
        source: "conversation-context",
      };
    }

    const previousOutput = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          message.outputType
      );

    if (!previousOutput?.outputType) {
      return null;
    }

    if (
      previousOutput.outputType === "image" ||
      previousOutput.outputType === "image-edit"
    ) {
      return {
        intent: /animate|video/i.test(prompt)
          ? "video"
          : "image-edit",
        score: 0.88,
        source: "conversation-context",
      };
    }

    if (
      previousOutput.outputType === "video" ||
      previousOutput.outputType === "video-edit"
    ) {
      return {
        intent: "video-edit",
        score: 0.88,
        source: "conversation-context",
      };
    }

    return null;
  }

  private createResult(
    input: {
      intent: ReuNexusIntent;
      confidence: number;
      source:
        | "explicit-command"
        | "rule"
        | "conversation-context"
        | "fallback";
      originalPrompt: string;
      normalizedPrompt: string;
      requiresClarification: boolean;
      clarificationQuestion?: string;
      context: IntentContext;
    }
  ): IntentResult {
    return {
      intent: input.intent,
      confidence: Number(
        Math.max(0, Math.min(input.confidence, 1)).toFixed(2)
      ),
      source: input.source,
      originalPrompt: input.originalPrompt,
      normalizedPrompt: input.normalizedPrompt,
      requiresClarification: input.requiresClarification,
      clarificationQuestion: input.clarificationQuestion,
      metadata: {
        isEditingRequest:
          input.intent === "image-edit" ||
          input.intent === "video-edit",
        isFollowUpRequest:
          Boolean(input.context.messages?.length) &&
          /^(make|change|turn|animate|edit|improve|add|remove|replace|continue)\b/i.test(
            input.normalizedPrompt
          ),
        requestedDurationSeconds:
          this.extractDuration(input.normalizedPrompt),
        requestedAspectRatio:
          this.extractAspectRatio(input.normalizedPrompt),
      },
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
    const ratio = prompt.match(
      /\b(1:1|4:3|3:4|16:9|9:16|21:9)\b/
    );

    if (ratio) {
      return ratio[1];
    }

    if (/\b(square)\b/i.test(prompt)) return "1:1";
    if (/\b(portrait|vertical)\b/i.test(prompt)) return "9:16";
    if (/\b(landscape|widescreen)\b/i.test(prompt)) return "16:9";

    return undefined;
  }

  private getClarificationQuestion(
    primary: ReuNexusIntent,
    competing?: ReuNexusIntent
  ): string {
    if (
      (primary === "image" && competing === "video") ||
      (primary === "video" && competing === "image")
    ) {
      return "Should ReuNexus create a still image or a video?";
    }

    return "Could you clarify what type of result you want ReuNexus to create?";
  }
}
