import type {
  EngineRequest,
  EngineResponse,
  EngineTaskType,
  ReuEngine,
} from "../types/Engine";

export abstract class BaseEngine
  implements ReuEngine
{
  abstract readonly name: string;
  abstract readonly type: EngineTaskType;

  canHandle(request: EngineRequest): boolean {
    return request.taskType === this.type;
  }

  abstract execute(
    request: EngineRequest
  ): Promise<EngineResponse>;

  protected validatePrompt(
    request: EngineRequest
  ): string {
    const prompt = request.prompt.trim();

    if (!prompt) {
      throw new Error(
        "A prompt is required."
      );
    }

    return prompt;
  }
}
