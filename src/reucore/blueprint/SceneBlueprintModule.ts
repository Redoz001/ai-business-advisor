import type {
  ModuleContext,
  ReuCoreMessage,
  ReuCoreModule,
} from "../core/Module";

import type { ReasonedPrompt } from "../reasoning/ReasoningModule";

export type SceneBlueprint = {
  title: string;
  description: string;
  mood: string;
  style: string;
  outputType: string;
  entities: {
    id: string;
    type: string;
    label: string;
  }[];
};

export class SceneBlueprintModule implements ReuCoreModule {
  readonly name = "scene-blueprint";

  private context?: ModuleContext;

  initialize(context: ModuleContext) {
    this.context = context;
  }

  async onMessage(message: ReuCoreMessage) {
    if (message.type !== "PROMPT_REASONED") return;

    const reasoned = message.payload as ReasonedPrompt;

    const blueprint: SceneBlueprint = {
      title: reasoned.subject,
      description: reasoned.originalPrompt,
      mood: reasoned.mood,
      style: reasoned.style,
      outputType: reasoned.outputType,
      entities: [
        {
          id: "main-subject",
          type: "concept",
          label: reasoned.subject,
        },
      ],
    };

    await this.context?.send(
      "SCENE_BLUEPRINT_CREATED",
      blueprint,
      this.name
    );
  }

  healthCheck() {
    return true;
  }
}