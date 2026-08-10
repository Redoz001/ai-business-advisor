import type {
  ModuleContext,
  ReuCoreModule,
  ReuCoreMessage,
} from "../core/Module";

export type ReasonedPrompt = {
  originalPrompt: string;
  subject: string;
  mood: string;
  style: string;
  outputType: "image" | "poster" | "hero" | "unknown";
};

export class ReasoningModule implements ReuCoreModule {
  readonly name = "reasoning";

  private context?: ModuleContext;

  initialize(context: ModuleContext) {
    this.context = context;
  }

  async onMessage(message: ReuCoreMessage) {
    if (message.type !== "PROMPT_RECEIVED") return;

    const prompt = String(message.payload || "");

    const result = this.reason(prompt);

    await this.context?.send(
      "PROMPT_REASONED",
      result,
      this.name
    );
  }

  reason(prompt: string): ReasonedPrompt {
    const text = prompt.toLowerCase();

    return {
      originalPrompt: prompt,
      subject: prompt,
      mood: text.includes("dark")
        ? "dark"
        : text.includes("happy")
        ? "positive"
        : "premium",
      style: text.includes("cinematic")
        ? "cinematic"
        : text.includes("poster")
        ? "poster"
        : text.includes("website")
        ? "website"
        : "futuristic",
      outputType: text.includes("poster")
        ? "poster"
        : text.includes("hero")
        ? "hero"
        : "image",
    };
  }

  healthCheck() {
    return true;
  }
}