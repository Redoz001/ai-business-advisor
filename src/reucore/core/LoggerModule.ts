import type { ReuCoreMessage, ReuCoreModule } from "./Module";

export class LoggerModule implements ReuCoreModule {
  readonly name = "logger";

  onMessage(message: ReuCoreMessage) {
    console.log("[ReuCore]", message.type, message.payload);
  }

  healthCheck() {
    return true;
  }
}